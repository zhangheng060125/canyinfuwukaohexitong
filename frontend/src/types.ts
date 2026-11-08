export type Role = "trainer" | "manager" | "owner";
export type User = { name: string; role: Role; tenant: "demo" | "live" };
export type Employee = {
  id: number;
  name: string;
  position: string;
  group_name: string;
  joined: string;
  active: number;
};
export type Assessment = {
  id: number;
  employee_id: number;
  assessed_on: string;
  course: string;
  assessor: string;
  scores: Record<string, number>;
  total: number;
  checks: Record<string, string>;
  notes: string;
  evidence: number[];
  duration: number | null;
  redlines: string[];
  created: string;
};
export type Training = {
  id: number;
  title: string;
  course: string;
  scheduled_on: string;
  time: string;
  minutes: number;
  method: string;
  attendees: number[];
  present: number[];
  issues: string;
  evidence: number[];
  status: string;
  creator: string;
};
export type Asset = {
  id: number;
  name: string;
  mime: string;
  size: number;
  category: string;
  uploader: string;
  created: string;
};
export type Directive = {
  id: number;
  employee_id: number | null;
  title: string;
  detail: string;
  due: string;
  priority: string;
  status: string;
  author: string;
  created: string;
};
export type Comment = {
  id: number;
  directive_id: number;
  transition: string;
  body: string;
  evidence: number[];
  author: string;
  role: Role;
  created: string;
};
export type Followup = {
  id: number;
  employee_id: number;
  recorded_on: string;
  encouragement: string;
  correction: string;
  evidence: number[];
  author: string;
};
export type Complaint = {
  id: number;
  employee_id: number;
  occurred_on: string;
  summary: string;
  heard: string;
  restated: string;
  solution: string;
  deadline: string;
  amount: number;
  approval: string;
  reported_to: string;
  status: string;
  creator: string;
  created: string;
};
export type State = {
  employees: Employee[];
  assessments: Assessment[];
  trainings: Training[];
  files: Asset[];
  directives: Directive[];
  comments: Comment[];
  followups: Followup[];
  complaints: Complaint[];
  audit: { id: number; actor: string; action: string; created: string }[];
  today: string;
};
export type Course = {
  id: string;
  name: string;
  day: number;
  minutes: number;
  goal: string;
  method: string;
  items: string[][];
  redline?: string;
  missing?: string;
};
export type Part = {
  key: string;
  name: string;
  max: number;
  group: string;
  hint: string;
};
export type Standards = {
  courses: Course[];
  parts: Part[];
  policies: {
    pass_score: number;
    assessment: string;
    teaching: string[];
    discipline: string[];
    followup: string;
  };
};
export type ModalSpec = { type: string; data?: any };
