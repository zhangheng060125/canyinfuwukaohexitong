from __future__ import annotations
import csv
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
import zipfile
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .standards import COURSES, POLICIES, SCORE_PARTS

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get('BAIHUALI_DATA_DIR', str(ROOT / 'data')))
DATA.mkdir(parents=True, exist_ok=True)
UPLOADS = DATA / 'uploads'
UPLOADS.mkdir(exist_ok=True)
DB = DATA / 'baihuali.sqlite3'
TZ = ZoneInfo('Asia/Shanghai')
app = FastAPI(title='百花里餐饮服务考核系统', docs_url=None, redoc_url=None)
ROLE_NAMES = {'trainer': '培训专员', 'manager': '餐饮经理', 'owner': '管理层 / 老板'}
COURSE_IDS = {c['id'] for c in COURSES}
LIMIT = 100 * 1024 * 1024


def now():
    return datetime.now(TZ).isoformat(timespec='seconds')


def today():
    return datetime.now(TZ).date()


@contextmanager
def db():
    conn = sqlite3.connect(DB, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def encode(v):
    return json.dumps(v, ensure_ascii=False)


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    return salt + ':' + hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310000).hex()


def initialize():
    with db() as c:
        c.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, tenant TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS employees(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, name TEXT NOT NULL, position TEXT NOT NULL, group_name TEXT NOT NULL, joined TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS assessments(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, employee_id INTEGER NOT NULL REFERENCES employees(id), assessed_on TEXT NOT NULL, course TEXT NOT NULL, assessor TEXT NOT NULL, scores TEXT NOT NULL, total REAL NOT NULL, checks TEXT NOT NULL, notes TEXT NOT NULL, evidence TEXT NOT NULL, duration INTEGER, redlines TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS trainings(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, title TEXT NOT NULL, course TEXT NOT NULL, scheduled_on TEXT NOT NULL, time TEXT NOT NULL, minutes INTEGER NOT NULL, method TEXT NOT NULL, attendees TEXT NOT NULL, present TEXT NOT NULL, issues TEXT NOT NULL, evidence TEXT NOT NULL, status TEXT NOT NULL, creator TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, name TEXT NOT NULL, stored TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, category TEXT NOT NULL, uploader TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS directives(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, employee_id INTEGER REFERENCES employees(id), title TEXT NOT NULL, detail TEXT NOT NULL, due TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', author TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, directive_id INTEGER NOT NULL REFERENCES directives(id), body TEXT NOT NULL, evidence TEXT NOT NULL, author TEXT NOT NULL, role TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS followups(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, employee_id INTEGER NOT NULL REFERENCES employees(id), recorded_on TEXT NOT NULL, encouragement TEXT NOT NULL, correction TEXT NOT NULL, evidence TEXT NOT NULL, author TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(tenant, employee_id, recorded_on));
        CREATE TABLE IF NOT EXISTS complaints(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, employee_id INTEGER NOT NULL REFERENCES employees(id), occurred_on TEXT NOT NULL, summary TEXT NOT NULL, heard TEXT NOT NULL, restated TEXT NOT NULL, solution TEXT NOT NULL, deadline TEXT NOT NULL, amount REAL NOT NULL, approval TEXT NOT NULL, reported_to TEXT NOT NULL, status TEXT NOT NULL, creator TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, created TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_assessment_tenant ON assessments(tenant, assessed_on);
        CREATE INDEX IF NOT EXISTS idx_files_tenant ON files(tenant);
        ''')
        if 'transition' not in {r['name'] for r in c.execute('PRAGMA table_info(comments)')}:
            c.execute("ALTER TABLE comments ADD COLUMN transition TEXT NOT NULL DEFAULT ''")
        if c.execute("SELECT 1 FROM employees WHERE tenant='demo'").fetchone():
            return
        people = [('李淑芬', '服务员', '前厅 A 组'), ('陈惠芳', '服务员', '前厅 A 组'), ('林小满', '服务员', '前厅 A 组'), ('周明', '餐饮经理', '前厅管理')]
        ids = []
        for name, position, group in people:
            ids.append(c.execute('INSERT INTO employees(tenant,name,position,group_name,joined) VALUES(?,?,?,?,?)', ('demo',name,position,group,str(today()-timedelta(days=65)))).lastrowid)
        for i in range(7):
            day = str(today()-timedelta(days=6-i))
            for j, eid in enumerate(ids):
                totals = [76, 84, 94, 92]
                total = max(60, totals[j] - (6-i)*2 + (1 if i%2 else 0))
                if i == 6:
                    total = totals[j]
                scores = {'table': 16 if j==0 else 18, 'hygiene':15 if j==0 else 19, 'service':14 if j==0 else 18, 'oral':8 if j==0 else 9}
                scores['observation'] = total-sum(scores.values())
                notes = ['巡台频次不足，杯中余水不足三分之一时未主动加水；需针对巡台动作二次培训。', '整体流程熟练，客诉方案需明确具体处理时间。', '迎宾主动、服务流程完整，能准确复述客诉四步。', '餐前四查到位，带教时注意一次只纠正一个动作。'][j]
                c.execute('INSERT INTO assessments(tenant,employee_id,assessed_on,course,assessor,scores,total,checks,notes,evidence,duration,redlines,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',('demo',eid,day,'all','许知夏',encode(scores),total,encode({'service:3':'improve' if j==0 else 'pass'}),notes,'[]',198+j*17,'[]',day+'T15:00:00+08:00'))
        for index, course in enumerate(COURSES):
            attendees = ids if index<4 else ids[1:]
            day = str(today()-timedelta(days=4-index))
            c.execute('INSERT INTO trainings(tenant,title,course,scheduled_on,time,minutes,method,attendees,present,issues,evidence,status,creator,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',('demo',course['name']+' · 实操带教',course['id'],day,'14:30',course['minutes'],'示范 → 学员实操 → 单动作纠正',encode(ids),encode(attendees),'巡台三看需要持续巩固。' if index==3 else '按检查点完成示范与实操；演示记录未附真实证据。','[]','completed','许知夏',now()))
        for k in range(4):
            c.execute('INSERT INTO followups(tenant,employee_id,recorded_on,encouragement,correction,evidence,author,created) VALUES(?,?,?,?,?,?,?,?)',('demo',ids[k],str(today()),'今天主动迎宾的动作有进步。','继续练习巡台三看，一次只纠正一个动作。','[]','许知夏',now()))
        for title, detail, offset, priority, eid, status in [
            ('加强巡台与主动加水训练','针对李淑芬安排一次巡台三看示范，跟岗观察杯子、骨碟、台面，次日提交训练结果。',1,'high',ids[0],'open'),
            ('补充客诉处理时间承诺','模拟菜品偏凉的客诉：方案必须包含具体动作与时间，按四步完整演练。',2,'normal',ids[1],'in_progress'),
            ('统一餐前检查留痕','餐前 15 分钟完成四查；上传签到表、实操照片及问题清单。',3,'normal',None,'open')]:
            c.execute('INSERT INTO directives(tenant,employee_id,title,detail,due,priority,status,author,created) VALUES(?,?,?,?,?,?,?,?,?)',('demo',eid,title,detail,str(today()+timedelta(days=offset)),priority,status,'沈总',now()))


initialize()


@app.middleware('http')
async def protect(request: Request, call_next):
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin = request.headers.get('origin')
        if origin:
            from urllib.parse import urlparse
            if urlparse(origin).netloc != request.headers.get('host'):
                return Response('跨站请求被拒绝', status_code=403)
    res = await call_next(request)
    res.headers['X-Content-Type-Options'] = 'nosniff'
    res.headers['Referrer-Policy'] = 'same-origin'
    res.headers['X-Frame-Options'] = 'SAMEORIGIN' if re.fullmatch(r'/api/files/\d+', request.url.path) else 'DENY'
    if request.url.path.startswith('/api'):
        res.headers['Cache-Control'] = 'no-store'
    return res


def current(request: Request):
    token = request.cookies.get('bhl_session','')
    with db() as c:
        row = c.execute('SELECT * FROM sessions WHERE token=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),time.time())).fetchone()
    if not row:
        raise HTTPException(401,'请先登录工作区')
    return dict(row)


def allow(user, roles):
    if user['role'] not in roles:
        raise HTTPException(403,'当前角色无此操作权限')


def audit(c, u, action):
    c.execute('INSERT INTO audit(tenant,actor,action,created) VALUES(?,?,?,?)',(u['tenant'],u['name'],action,now()))


def fetch(c, table, id, u):
    row = c.execute(f'SELECT * FROM {table} WHERE id=? AND tenant=?',(id,u['tenant'])).fetchone()
    if not row:
        raise HTTPException(404,'记录不存在')
    return dict(row)


def employee_check(c, ids, u):
    for eid in set(ids):
        fetch(c,'employees',eid,u)


def file_check(c, ids, u):
    for fid in set(ids):
        fetch(c,'files',fid,u)


def date_check(s, future=False):
    try:
        d = datetime.strptime(s,'%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(422,'日期格式须为 YYYY-MM-DD')
    if not future and d > today():
        raise HTTPException(422,'记录日期不能晚于今天')
    return d


def session(response, uid, tenant, name, role):
    token = secrets.token_urlsafe(40)
    with db() as c:
        c.execute('DELETE FROM sessions WHERE expires<?',(time.time(),))
        c.execute('INSERT INTO sessions VALUES(?,?,?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),uid,tenant,name,role,time.time()+12*3600))
    response.set_cookie('bhl_session',token,httponly=True,samesite='lax',max_age=12*3600,secure=os.environ.get('COOKIE_SECURE')=='1')
    return {'name':name,'role':role,'tenant':tenant}


class Credentials(BaseModel):
    username: str = Field(min_length=3,max_length=50,pattern=r'^[a-zA-Z0-9_.-]+$')
    password: str = Field(min_length=10,max_length=128)
    name: str = Field(default='',max_length=40)
    role: str = 'trainer'
    setup_key: str = Field(default='', max_length=256)


class Demo(BaseModel):
    role: str = 'trainer'


@app.get('/api/auth/status')
def auth_status(request: Request):
    with db() as c:
        initialized = bool(c.execute('SELECT 1 FROM users').fetchone())
    key_required = bool(os.environ.get('BAIHUALI_SETUP_KEY')) or os.environ.get('BAIHUALI_REQUIRE_SETUP_KEY') == '1'
    result = {'initialized':initialized, 'setup_key_required':not initialized and key_required}
    try:
        u = current(request)
        return {**result,'user':{k:u[k] for k in ('name','role','tenant')}}
    except HTTPException:
        return {**result,'user':None}


@app.post('/api/auth/demo')
def demo(body: Demo, response: Response):
    if body.role not in ROLE_NAMES:
        raise HTTPException(422,'无效角色')
    return session(response,None,'demo',{'trainer':'许知夏','manager':'周明','owner':'沈总'}[body.role],body.role)


@app.post('/api/auth/bootstrap')
def bootstrap(body: Credentials, response: Response):
    expected_key = os.environ.get('BAIHUALI_SETUP_KEY', '')
    if os.environ.get('BAIHUALI_REQUIRE_SETUP_KEY') == '1' and not expected_key:
        raise HTTPException(503,'网站初始化尚未配置，请管理员在托管平台设置初始化密钥')
    if expected_key and not hmac.compare_digest(body.setup_key.encode(), expected_key.encode()):
        raise HTTPException(403,'初始化密钥不正确，请从网站托管平台的环境设置中获取')
    if not body.name.strip():
        raise HTTPException(422,'请填写姓名')
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        if c.execute('SELECT 1 FROM users').fetchone():
            raise HTTPException(409,'管理员已创建，请登录')
        uid = c.execute('INSERT INTO users(username,name,role,password) VALUES(?,?,?,?)',(body.username,body.name.strip(),'owner',password_hash(body.password))).lastrowid
    return session(response,uid,'live',body.name.strip(),'owner')


ATTEMPTS = {}


@app.post('/api/auth/login')
def login(body: Credentials, request: Request, response: Response):
    key = (request.client.host if request.client else '',body.username)
    attempts = [t for t in ATTEMPTS.get(key,[]) if time.time()-t<300]
    if len(attempts)>=8:
        raise HTTPException(429,'尝试次数过多，请 5 分钟后重试')
    with db() as c:
        row = c.execute('SELECT * FROM users WHERE username=?',(body.username,)).fetchone()
    dummy = '0'*32
    actual = password_hash(body.password,row['password'].split(':')[0] if row else dummy)
    if not row or not hmac.compare_digest(actual,row['password']):
        ATTEMPTS[key] = attempts+[time.time()]
        raise HTTPException(401,'账号或密码不正确')
    ATTEMPTS.pop(key,None)
    return session(response,row['id'],'live',row['name'],row['role'])


@app.post('/api/auth/logout')
def logout(request: Request, response: Response):
    token = request.cookies.get('bhl_session','')
    with db() as c:
        c.execute('DELETE FROM sessions WHERE token=?',(hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie('bhl_session')
    return {'ok':True}


@app.get('/api/standards')
def standards(u=Depends(current)):
    return {'courses':COURSES,'parts':SCORE_PARTS,'policies':POLICIES}


@app.get('/api/state')
def state(u=Depends(current)):
    result = {}
    fields = {'assessments':['scores','checks','evidence','redlines'],'trainings':['attendees','present','evidence'],'comments':['evidence'],'followups':['evidence']}
    with db() as c:
        for table in ('employees','assessments','trainings','files','directives','comments','followups','complaints','audit'):
            rows = [dict(r) for r in c.execute(f'SELECT * FROM {table} WHERE tenant=? ORDER BY id DESC',(u['tenant'],)).fetchall()]
            for row in rows:
                row.pop('tenant',None)
                row.pop('stored',None)
                for key in fields.get(table,[]):
                    row[key] = json.loads(row[key])
            result[table] = rows
    result['today'] = str(today())
    return result


class Employee(BaseModel):
    name: str = Field(min_length=1,max_length=40)
    position: str = Field(min_length=1,max_length=40)
    group_name: str = Field(default='前厅',max_length=40)
    joined: str


@app.post('/api/employees')
def add_employee(body: Employee,u=Depends(current)):
    allow(u,('trainer','manager','owner'))
    date_check(body.joined)
    if not body.name.strip():
        raise HTTPException(422,'请填写员工姓名')
    with db() as c:
        eid = c.execute('INSERT INTO employees(tenant,name,position,group_name,joined) VALUES(?,?,?,?,?)',(u['tenant'],body.name.strip(),body.position,body.group_name,body.joined)).lastrowid
        audit(c,u,'添加员工：'+body.name)
    return {'id':eid}


@app.patch('/api/employees/{eid}/archive')
def archive_employee(eid:int,u=Depends(current)):
    allow(u,('manager','owner'))
    with db() as c:
        row = fetch(c,'employees',eid,u)
        c.execute('UPDATE employees SET active=? WHERE id=?',(0 if row['active'] else 1,eid))
        audit(c,u,('停用' if row['active'] else '恢复')+'员工：'+row['name'])
    return {'ok':True}


class Assessment(BaseModel):
    employee_id: int
    assessed_on: str
    course: str = 'all'
    scores: dict[str,float]
    checks: dict[str,str] = {}
    notes: str = Field(min_length=1,max_length=4000)
    evidence: list[int] = Field(default=[],max_length=30)
    duration: int | None = Field(default=None,ge=0,le=86400)
    redlines: list[str] = []


@app.post('/api/assessments')
def assessment(body: Assessment,u=Depends(current)):
    allow(u,('trainer','manager'))
    date_check(body.assessed_on)
    if body.course not in COURSE_IDS | {'all'}:
        raise HTTPException(422,'课程无效')
    if set(body.scores) != {p['key'] for p in SCORE_PARTS}:
        raise HTTPException(422,'须填写五项考核评分')
    for p in SCORE_PARTS:
        value = body.scores[p['key']]
        if not 0<=value<=p['max'] or value*10!=round(value*10):
            raise HTTPException(422,p['name']+'分值无效，支持一位小数')
    known_checks = {f"{co['id']}:{i}" for co in COURSES for i in range(len(co['items']))}
    if any(k not in known_checks or v not in ('pass','improve','unchecked') for k,v in body.checks.items()):
        raise HTTPException(422,'检查项无效')
    if any(r not in ('sick','privacy') for r in body.redlines):
        raise HTTPException(422,'红线标记无效')
    if not body.notes.strip():
        raise HTTPException(422,'须填写观察反馈及扣分依据')
    total = round(sum(body.scores.values()),1)
    with db() as c:
        emp = fetch(c,'employees',body.employee_id,u)
        if not emp['active']:
            raise HTTPException(422,'已停用员工不可新增考核')
        file_check(c,body.evidence,u)
        aid = c.execute('INSERT INTO assessments(tenant,employee_id,assessed_on,course,assessor,scores,total,checks,notes,evidence,duration,redlines,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',(u['tenant'],body.employee_id,body.assessed_on,body.course,u['name'],encode(body.scores),total,encode(body.checks),body.notes,encode(body.evidence),body.duration,encode(body.redlines),now())).lastrowid
        if body.redlines:
            c.execute('INSERT INTO directives(tenant,employee_id,title,detail,due,priority,status,author,created) VALUES(?,?,?,?,?,?,?,?,?)',(u['tenant'],body.employee_id,'红线事件 · 立即核查',body.notes,str(today()),'high','open',u['name'],now()))
        audit(c,u,f"提交考核：{emp['name']} · {total:g} 分"+('，需二次培训' if total<80 else ''))
    return {'id':aid,'total':total,'passed':total>=80}


class Training(BaseModel):
    title: str = Field(min_length=1,max_length=100)
    course: str
    scheduled_on: str
    time: str = '14:30'
    minutes: int = Field(ge=1,le=480)
    method: str = Field(min_length=1,max_length=400)
    attendees: list[int] = Field(min_length=1,max_length=200)
    present: list[int] = Field(default=[],max_length=200)
    issues: str = Field(default='',max_length=4000)
    evidence: list[int] = Field(default=[],max_length=30)
    status: str = 'planned'


@app.post('/api/trainings')
def training(body: Training,u=Depends(current)):
    allow(u,('trainer','manager'))
    date_check(body.scheduled_on,True)
    if body.course not in COURSE_IDS or body.status not in ('planned','completed') or not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d',body.time):
        raise HTTPException(422,'课程、状态或时间无效')
    if not set(body.present).issubset(set(body.attendees)):
        raise HTTPException(422,'签到员工须在参训名单内')
    if body.status=='completed':
        date_check(body.scheduled_on)
        if not body.issues.strip():
            raise HTTPException(422,'完成培训须填写当次问题清单，可填写未发现问题')
    with db() as c:
        employee_check(c,body.attendees,u)
        file_check(c,body.evidence,u)
        tid = c.execute('INSERT INTO trainings(tenant,title,course,scheduled_on,time,minutes,method,attendees,present,issues,evidence,status,creator,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(u['tenant'],body.title,body.course,body.scheduled_on,body.time,body.minutes,body.method,encode(list(set(body.attendees))),encode(list(set(body.present))),body.issues,encode(body.evidence),body.status,u['name'],now())).lastrowid
        audit(c,u,'记录培训：'+body.title)
    return {'id':tid}


class TrainingComplete(BaseModel):
    present: list[int]
    issues: str = Field(min_length=1,max_length=4000)
    evidence: list[int] = Field(default=[],max_length=30)


@app.post('/api/trainings/{tid}/complete')
def complete(tid:int,body:TrainingComplete,u=Depends(current)):
    allow(u,('trainer','manager'))
    with db() as c:
        row = fetch(c,'trainings',tid,u)
        date_check(row['scheduled_on'])
        if row['status']!='planned':
            raise HTTPException(409,'培训已经完成，不能重复提交')
        if not set(body.present).issubset(json.loads(row['attendees'])) or not body.issues.strip():
            raise HTTPException(422,'签到名单或问题清单无效')
        file_check(c,body.evidence,u)
        c.execute("UPDATE trainings SET status='completed',present=?,issues=?,evidence=? WHERE id=?",(encode(body.present),body.issues,encode(body.evidence),tid))
        audit(c,u,'完成培训与签到：'+row['title'])
    return {'ok':True}


class Directive(BaseModel):
    employee_id: int | None = None
    title: str = Field(min_length=1,max_length=100)
    detail: str = Field(min_length=1,max_length=4000)
    due: str
    priority: str = 'normal'


@app.post('/api/directives')
def directive(body:Directive,u=Depends(current)):
    allow(u,('manager','owner'))
    date_check(body.due,True)
    if body.priority not in ('normal','high') or not body.title.strip() or not body.detail.strip():
        raise HTTPException(422,'请完整填写指令')
    with db() as c:
        if body.employee_id:
            employee_check(c,[body.employee_id],u)
        did=c.execute('INSERT INTO directives(tenant,employee_id,title,detail,due,priority,author,created) VALUES(?,?,?,?,?,?,?,?)',(u['tenant'],body.employee_id,body.title,body.detail,body.due,body.priority,u['name'],now())).lastrowid
        audit(c,u,'下达指令：'+body.title)
    return {'id':did}


class Comment(BaseModel):
    body: str = Field(min_length=1,max_length=4000)
    evidence: list[int] = Field(default=[],max_length=30)
    transition: str | None = None


@app.post('/api/directives/{did}/comments')
def comment(did:int,body:Comment,u=Depends(current)):
    with db() as c:
        d=fetch(c,'directives',did,u)
        file_check(c,body.evidence,u)
        if not body.body.strip():
            raise HTTPException(422,'请填写反馈')
        transitions={'open':{'in_progress'},'in_progress':{'submitted'},'submitted':{'closed','in_progress'},'closed':set()}
        if body.transition:
            if body.transition not in transitions[d['status']]:
                raise HTTPException(409,'指令状态已变化，请刷新后再操作')
            if d['status']=='submitted':
                allow(u,('manager','owner'))
            if body.transition in ('in_progress','submitted') and d['status']!='submitted':
                allow(u,('trainer','manager'))
            c.execute('UPDATE directives SET status=? WHERE id=?',(body.transition,did))
        c.execute('INSERT INTO comments(tenant,directive_id,body,evidence,author,role,created,transition) VALUES(?,?,?,?,?,?,?,?)',(u['tenant'],did,body.body,encode(body.evidence),u['name'],u['role'],now(),body.transition or ''))
        audit(c,u,'反馈指令：'+d['title']+((' → '+body.transition) if body.transition else ''))
    return {'ok':True}


class Followup(BaseModel):
    employee_id:int
    recorded_on:str
    encouragement:str = Field(min_length=1,max_length=2000)
    correction:str = Field(min_length=1,max_length=2000)
    evidence:list[int] = Field(default=[],max_length=30)


@app.post('/api/followups')
def followup(body:Followup,u=Depends(current)):
    allow(u,('trainer','manager'))
    date_check(body.recorded_on)
    with db() as c:
        employee_check(c,[body.employee_id],u)
        file_check(c,body.evidence,u)
        if not body.encouragement.strip() or not body.correction.strip():
            raise HTTPException(422,'请填写鼓励与纠正内容')
        try:
            fid=c.execute('INSERT INTO followups(tenant,employee_id,recorded_on,encouragement,correction,evidence,author,created) VALUES(?,?,?,?,?,?,?,?)',(u['tenant'],body.employee_id,body.recorded_on,body.encouragement,body.correction,encode(body.evidence),u['name'],now())).lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(409,'该员工当日已有跟岗记录，请勿重复提交')
        audit(c,u,'记录每日跟岗')
    return {'id':fid}



class Complaint(BaseModel):
    employee_id:int
    occurred_on:str
    summary:str = Field(min_length=1,max_length=2000)
    heard:str = Field(min_length=1,max_length=2000)
    restated:str = Field(min_length=1,max_length=2000)
    solution:str = Field(min_length=1,max_length=2000)
    deadline:str = Field(min_length=1,max_length=200)
    amount:float = Field(ge=0,le=100000)
    reported_to:str = Field(min_length=1,max_length=100)


@app.post('/api/complaints')
def complaint(body:Complaint,u=Depends(current)):
    allow(u,('trainer','manager'))
    date_check(body.occurred_on)
    for key in ('summary','heard','restated','solution','deadline','reported_to'):
        if not getattr(body,key).strip():
            raise HTTPException(422,'客诉四步和上报记录须完整填写')
    with db() as c:
        employee_check(c,[body.employee_id],u)
        status='pending_approval' if body.amount>50 else 'recorded'
        cid=c.execute('INSERT INTO complaints(tenant,employee_id,occurred_on,summary,heard,restated,solution,deadline,amount,approval,reported_to,status,creator,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(u['tenant'],body.employee_id,body.occurred_on,body.summary,body.heard,body.restated,body.solution,body.deadline,body.amount,'',body.reported_to,status,u['name'],now())).lastrowid
        audit(c,u,'登记客诉：'+body.summary[:60])
    return {'id':cid}


@app.post('/api/complaints/{cid}/approve')
def approve_complaint(cid:int,u=Depends(current)):
    allow(u,('manager','owner'))
    with db() as c:
        row=fetch(c,'complaints',cid,u)
        if row['status']!='pending_approval':
            raise HTTPException(409,'当前客诉无需重复审批')
        c.execute("UPDATE complaints SET approval=?,status='approved' WHERE id=?",(u['name']+' · '+now(),cid))
        audit(c,u,'批准客诉处理：'+row['summary'][:60])
    return {'ok':True}


FILE_TYPES={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.doc':'application/msword','.xls':'application/vnd.ms-excel','.csv':'text/csv','.txt':'text/plain'}


def valid_content(path, ext):
    with path.open('rb') as f:
        head=f.read(64)
    if ext in ('.jpg','.jpeg'): return head.startswith(b'\xff\xd8\xff')
    if ext=='.png': return head.startswith(b'\x89PNG\r\n\x1a\n')
    if ext=='.webp': return head[:4]==b'RIFF' and head[8:12]==b'WEBP'
    if ext=='.pdf': return head.startswith(b'%PDF-')
    if ext in ('.mp4','.mov'): return head[4:8]==b'ftyp' or head[4:8] in (b'moov',b'mdat',b'wide')
    if ext=='.webm': return head.startswith(b'\x1aE\xdf\xa3')
    if ext in ('.doc','.xls'): return head.startswith(bytes.fromhex('d0cf11e0a1b11ae1'))
    if ext in ('.docx','.xlsx'):
        try:
            with zipfile.ZipFile(path) as z:
                required='word/document.xml' if ext=='.docx' else 'xl/workbook.xml'
                return '[Content_Types].xml' in z.namelist() and required in z.namelist()
        except zipfile.BadZipFile: return False
    return b'\x00' not in head


@app.post('/api/files')
async def upload(file:UploadFile=File(...),category:str='培训资料',u=Depends(current)):
    allow(u,('trainer','manager','owner'))
    name=Path((file.filename or '').replace('\\','/')).name[:180]
    ext=Path(name).suffix.lower()
    if ext not in FILE_TYPES:
        raise HTTPException(422,'支持 JPG、PNG、WebP、MP4、WebM、MOV、PDF、Word、Excel、CSV、TXT')
    if category not in ('实操照片','实操视频','签到表','问题清单','培训资料','摆台 SOP','整改证据'):
        raise HTTPException(422,'资料分类无效')
    stored=secrets.token_hex(24)+ext
    path=UPLOADS/stored
    size=0
    try:
        with path.open('wb') as out:
            while chunk:=await file.read(1024*1024):
                size+=len(chunk)
                if size>LIMIT:
                    raise HTTPException(413,'单个文件不得超过 100 MB')
                out.write(chunk)
        if not size or not valid_content(path,ext):
            raise HTTPException(422,'文件为空或内容与扩展名不匹配')
        with db() as c:
            fid=c.execute('INSERT INTO files(tenant,name,stored,mime,size,category,uploader,created) VALUES(?,?,?,?,?,?,?,?)',(u['tenant'],name,stored,FILE_TYPES[ext],size,category,u['name'],now())).lastrowid
            audit(c,u,'上传资料：'+name)
        return {'id':fid,'name':name,'size':size,'mime':FILE_TYPES[ext],'category':category}
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@app.get('/api/files/{fid}')
def download(fid:int,download:bool=False,u=Depends(current)):
    with db() as c:
        f=fetch(c,'files',fid,u)
    path=UPLOADS/f['stored']
    if not path.exists():
        raise HTTPException(404,'附件文件不存在，请从备份恢复')
    inline=f['mime'].startswith(('image/','video/')) or f['mime']=='application/pdf'
    return FileResponse(path,media_type=f['mime'],filename=f['name'],content_disposition_type='inline' if inline and not download else 'attachment')


@app.get('/api/source')
def source(u=Depends(current)):
    return FileResponse(ROOT/'docs/百花里餐饮部员工培训计划书.docx',filename='百花里餐饮部员工培训计划书.docx')


@app.get('/api/users')
def users(u=Depends(current)):
    allow(u,('owner',))
    if u['tenant']=='demo':
        return []
    with db() as c:
        return [dict(r) for r in c.execute('SELECT id,username,name,role FROM users ORDER BY id')]


@app.post('/api/users')
def create_user(body:Credentials,u=Depends(current)):
    allow(u,('owner',))
    if u['tenant']=='demo':
        raise HTTPException(403,'请进入正式工作区管理真实账号')
    if body.role not in ROLE_NAMES or not body.name.strip():
        raise HTTPException(422,'请填写有效姓名和角色')
    with db() as c:
        try:
            uid=c.execute('INSERT INTO users(username,name,role,password) VALUES(?,?,?,?)',(body.username,body.name.strip(),body.role,password_hash(body.password))).lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(409,'账号已存在')
        audit(c,u,'创建账号：'+body.name)
    return {'id':uid}


@app.get('/api/reports/export')
def report(start:str,end:str,u=Depends(current)):
    date_check(start,True)
    date_check(end,True)
    if start>end:
        raise HTTPException(422,'开始日期不能晚于结束日期')
    with db() as c:
        rows=c.execute('SELECT a.*,e.name,e.position FROM assessments a JOIN employees e ON a.employee_id=e.id WHERE a.tenant=? AND a.assessed_on>=? AND a.assessed_on<=? ORDER BY a.assessed_on DESC,a.id DESC',(u['tenant'],start,end)).fetchall()
    out=io.StringIO(newline='')
    writer=csv.writer(out)
    writer.writerow(['考核日期','员工','岗位','摆台计时 /20','卫生抽查 /20','服务流程 /20','现场观察 /30','口述 /10','总分 /100','结果','红线记录','考核人','反馈','附件数量'])
    def safe(value):
        text=str(value)
        return "'"+text if text.lstrip().startswith(('=','+','-','@')) else text
    for r in rows:
        scores=json.loads(r['scores'])
        writer.writerow([r['assessed_on'],safe(r['name']),safe(r['position']),*[scores[p['key']] for p in SCORE_PARTS],r['total'],'合格' if r['total']>=80 else '需二次培训','有' if json.loads(r['redlines']) else '无',safe(r['assessor']),safe(r['notes']),len(json.loads(r['evidence']))])
    return StreamingResponse(iter([('\ufeff'+out.getvalue()).encode('utf-8')]),media_type='text/csv; charset=utf-8',headers={'Content-Disposition':f'attachment; filename="baihuali-assessments-{start}-{end}.csv"'})


@app.get('/api/health')
def health():
    with db() as c:
        c.execute('SELECT 1').fetchone()
    return {'status':'ok'}


DIST=ROOT/'frontend/dist'
if DIST.exists():
    app.mount('/assets',StaticFiles(directory=DIST/'assets'),name='assets')

    @app.get('/{path:path}')
    def frontend(path:str):
        if path.startswith('api/'):
            raise HTTPException(404,'接口不存在')
        return FileResponse(DIST/'index.html')
