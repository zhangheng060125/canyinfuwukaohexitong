"""端到端 API 行为测试：独立临时数据库，不触碰工作区数据。"""
import csv
import io
import os
import tempfile
import unittest
from unittest.mock import patch
from datetime import timedelta
from pathlib import Path

TEST_DATA = tempfile.TemporaryDirectory(prefix='baihuali-test-')
os.environ['BAIHUALI_DATA_DIR'] = TEST_DATA.name
# Deployment secrets must never configure isolated test users.
os.environ.pop('BAIHUALI_SETUP_KEY', None)
os.environ.pop('BAIHUALI_REQUIRE_SETUP_KEY', None)
from fastapi.testclient import TestClient
from backend.app import app, today


class WorkflowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.owner = TestClient(app)
        r=cls.owner.post('/api/auth/bootstrap',json={'username':'test.owner','password':'Test-unique-pass-2026','name':'测试管理员'})
        assert r.status_code==200,r.text
        for name,role in [('trainer','trainer'),('manager','manager')]:
            r=cls.owner.post('/api/users',json={'username':name,'password':'Test-unique-pass-2026','name':'测试'+role,'role':role})
            assert r.status_code==200,r.text
        cls.trainer=TestClient(app)
        cls.trainer.post('/api/auth/login',json={'username':'trainer','password':'Test-unique-pass-2026'})
        cls.manager=TestClient(app)
        cls.manager.post('/api/auth/login',json={'username':'manager','password':'Test-unique-pass-2026'})
        cls.demo=TestClient(app)
        cls.demo.post('/api/auth/demo',json={'role':'trainer'})

    def employee(self,name='测试员工'):
        r=self.trainer.post('/api/employees',json={'name':name,'position':'服务员','group_name':'前厅','joined':str(today())})
        self.assertEqual(r.status_code,200,r.text)
        return r.json()['id']

    def assessment(self,eid,**extra):
        body={'employee_id':eid,'assessed_on':str(today()),'course':'all','scores':{'table':15,'hygiene':15,'service':15,'observation':24,'oral':8},'notes':'巡台未主动加水，需二次培训。','checks':{'service:3':'improve'}}
        body.update(extra)
        return self.trainer.post('/api/assessments',json=body)

    def test_auth_and_isolation(self):
        anon=TestClient(app)
        self.assertEqual(anon.get('/api/state').status_code,401)
        self.assertEqual(anon.post('/api/auth/demo',json={'role':'bad'}).status_code,422)
        self.assertEqual(self.demo.post('/api/users',json={'username':'bad','password':'something-long','name':'坏'}).status_code,403)
        self.assertEqual(self.owner.post('/api/auth/bootstrap',json={'username':'second','password':'something-long','name':'再建'}).status_code,409)
        eid=self.employee()
        self.assertNotIn(eid,[e['id'] for e in self.demo.get('/api/state').json()['employees']])
        body={'employee_id':eid,'assessed_on':str(today()),'scores':{'table':20,'hygiene':20,'service':20,'observation':30,'oral':10},'notes':'跨租户测试'}
        self.assertEqual(self.demo.post('/api/assessments',json=body).status_code,404)
        self.assertEqual(self.trainer.post('/api/auth/demo',json={'role':'trainer'},headers={'Origin':'https://evil.example'}).status_code,403)

    def test_public_bootstrap_protection(self):
        client=TestClient(app)
        body={'username':'new-owner','password':'Test-unique-pass-2026','name':'测试'}
        with patch.dict(os.environ, {'BAIHUALI_REQUIRE_SETUP_KEY':'1','BAIHUALI_SETUP_KEY':''}):
            self.assertEqual(client.post('/api/auth/bootstrap',json=body).status_code,503)
        with patch.dict(os.environ, {'BAIHUALI_SETUP_KEY':'test-bootstrap-secret-only'}):
            self.assertEqual(client.post('/api/auth/bootstrap',json=body).status_code,403)
            self.assertNotIn('test-bootstrap-secret-only',client.get('/api/auth/status').text)
            self.assertEqual(client.post('/api/auth/bootstrap',json={**body,'setup_key':'test-bootstrap-secret-only'}).status_code,409)

    def test_score_rules_and_immutable_history(self):
        eid=self.employee()
        r=self.assessment(eid)
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.json()['total'],77)
        self.assertFalse(r.json()['passed'])
        self.assertEqual(self.assessment(eid,scores={'table':21,'hygiene':20,'service':20,'observation':30,'oral':10}).status_code,422)
        self.assertEqual(self.assessment(eid,scores={'table':0}).status_code,422)
        self.assertEqual(self.assessment(eid,assessed_on=str(today()+timedelta(days=1))).status_code,422)
        self.assertEqual(self.assessment(eid,checks={'fake:99':'pass'}).status_code,422)
        passed=self.assessment(eid,scores={'table':16,'hygiene':16,'service':16,'observation':24,'oral':8},redlines=['sick'])
        self.assertEqual(passed.json()['total'],80)
        self.assertTrue(passed.json()['passed'])
        state=self.trainer.get('/api/state').json()
        self.assertTrue(any(d['employee_id']==eid and d['priority']=='high' for d in state['directives']))
        records=[a for a in state['assessments'] if a['employee_id']==eid]
        self.assertEqual(len(records),2)
        self.assertEqual(records[-1]['total'],77)
        self.assertEqual(self.owner.post('/api/assessments',json={'employee_id':eid,'assessed_on':str(today()),'scores':{'table':20,'hygiene':20,'service':20,'observation':30,'oral':10},'notes':'老板不评分'}).status_code,403)

    def test_files_persist_and_are_scoped(self):
        r=self.trainer.post('/api/files?category=签到表',files={'file':('签到.csv','姓名,签到\n张三,已到场'.encode(),'text/csv')})
        self.assertEqual(r.status_code,200,r.text)
        fid=r.json()['id']
        downloaded=self.trainer.get(f'/api/files/{fid}')
        self.assertIn('张三',downloaded.content.decode())
        self.assertEqual(self.demo.get(f'/api/files/{fid}').status_code,404)
        self.assertEqual(self.trainer.post('/api/files',files={'file':('bad.jpg',b'<script>bad</script>','image/jpeg')}).status_code,422)
        self.assertEqual(self.trainer.post('/api/files',files={'file':('bad.html',b'<p>bad</p>','text/html')}).status_code,422)
        word=Path('docs/百花里餐饮部员工培训计划书.docx').read_bytes()
        self.assertEqual(self.trainer.post('/api/files',files={'file':('计划.docx',word)}).status_code,200)
        eid=self.employee()
        self.assertEqual(self.assessment(eid,evidence=[fid]).status_code,200)
        self.assertEqual(self.assessment(eid,evidence=[9999999]).status_code,404)

    def test_training_attendance_and_followup(self):
        eid=self.employee()
        body={'title':'服务流程实操','course':'service','scheduled_on':str(today()),'time':'14:30','minutes':30,'method':'先示范再实操','attendees':[eid],'status':'planned'}
        r=self.trainer.post('/api/trainings',json=body)
        self.assertEqual(r.status_code,200,r.text)
        tid=r.json()['id']
        self.assertEqual(self.trainer.post(f'/api/trainings/{tid}/complete',json={'present':[999999],'issues':'不应签到'}).status_code,422)
        self.assertEqual(self.trainer.post(f'/api/trainings/{tid}/complete',json={'present':[eid],'issues':'练习巡台三看'}).status_code,200)
        self.assertEqual(self.trainer.post(f'/api/trainings/{tid}/complete',json={'present':[eid],'issues':'重复提交'}).status_code,409)
        f={'employee_id':eid,'recorded_on':str(today()),'encouragement':'迎宾更主动','correction':'巡台时留意杯子'}
        self.assertEqual(self.trainer.post('/api/followups',json=f).status_code,200)
        self.assertEqual(self.trainer.post('/api/followups',json=f).status_code,409)

    def test_management_execution_review_loop(self):
        eid=self.employee()
        b={'employee_id':eid,'title':'巡台纠正','detail':'示范并复训，上传留痕','due':str(today()),'priority':'high'}
        self.assertEqual(self.trainer.post('/api/directives',json=b).status_code,403)
        r=self.owner.post('/api/directives',json=b)
        self.assertEqual(r.status_code,200,r.text)
        did=r.json()['id']
        url=f'/api/directives/{did}/comments'
        self.assertEqual(self.trainer.post(url,json={'body':'跳步关闭','transition':'closed'}).status_code,409)
        self.assertEqual(self.trainer.post(url,json={'body':'开始训练','transition':'in_progress'}).status_code,200)
        self.assertEqual(self.trainer.post(url,json={'body':'完成示范，申请验收','transition':'submitted'}).status_code,200)
        self.assertEqual(self.trainer.post(url,json={'body':'越权验收','transition':'closed'}).status_code,403)
        self.assertEqual(self.manager.post(url,json={'body':'尚未通过，继续练习','transition':'in_progress'}).status_code,200)
        self.assertEqual(self.trainer.post(url,json={'body':'再次练习后已改正','transition':'submitted'}).status_code,200)
        self.assertEqual(self.owner.post(url,json={'body':'抽查通过','transition':'closed'}).status_code,200)
        state=self.owner.get('/api/state').json()
        self.assertEqual(next(d for d in state['directives'] if d['id']==did)['status'],'closed')
        self.assertEqual(len([c for c in state['comments'] if c['directive_id']==did]),5)

    def test_complaint_approval_and_csv(self):
        eid=self.employee('=SUM(1,1)')
        b={'employee_id':eid,'occurred_on':str(today()),'summary':'菜品偏凉','heard':'听完客人意见','restated':'确认菜品偏凉','solution':'重新做一份','deadline':'10 分钟内','amount':68,'reported_to':'餐饮经理'}
        r=self.trainer.post('/api/complaints',json=b)
        self.assertEqual(r.status_code,200,r.text)
        cid=r.json()['id']
        self.assertEqual(self.trainer.post(f'/api/complaints/{cid}/approve').status_code,403)
        self.assertEqual(self.manager.post(f'/api/complaints/{cid}/approve').status_code,200)
        c=next(c for c in self.owner.get('/api/state').json()['complaints'] if c['id']==cid)
        self.assertEqual(c['status'],'approved')
        self.assertTrue(c['approval'])
        self.assessment(eid)
        r=self.owner.get('/api/reports/export',params={'start':str(today()),'end':str(today())})
        self.assertEqual(r.status_code,200)
        rows=list(csv.reader(io.StringIO(r.content.decode('utf-8-sig'))))
        self.assertTrue(any(row[1]=="'=SUM(1,1)" for row in rows))
        self.assertEqual(self.owner.get('/api/reports/export',params={'start':str(today()),'end':'2020-01-01'}).status_code,422)


if __name__=='__main__':
    unittest.main()
