export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar?: string;
  user_type: string;
  institution_id: string | null;
  institution_name?: string;
  institution_code?: string;
  role: {
    id: string;
    name: string;
    display_name: string;
  };
  branch?: {
    id: string;
    name: string;
  } | null;
  permissions?: string[];
}

export interface Branch {
  id: string;
  institution_id: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  is_main: number;
  is_active: number;
  student_count?: number;
  employee_count?: number;
  created_at: string;
}

export interface Student {
  id: string;
  admission_number: string;
  registration_number?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  county?: string;
  address?: string;
  phone?: string;
  email?: string;
  photo?: string;
  blood_group?: string;
  medical_info?: string;
  previous_school?: string;
  previous_class?: string;
  admission_date?: string;
  branch_id?: string;
  class_id?: string;
  section_id?: string;
  session_id?: string;
  status: string;
  class_name?: string;
  section_name?: string;
  branch_name?: string;
  session_name?: string;
  parents?: Parent[];
  created_at: string;
}

export interface Parent {
  id: string;
  first_name: string;
  last_name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  workplace?: string;
  photo?: string;
  is_primary?: number;
  children_count?: number;
  children?: Student[];
  created_at: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  address?: string;
  photo?: string;
  department_id?: string;
  designation_id?: string;
  branch_id?: string;
  qualification?: string;
  experience?: string;
  employment_date?: string;
  employment_type: string;
  basic_salary: number;
  bank_name?: string;
  bank_account?: string;
  is_teacher: number;
  is_active: number;
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  assignments?: TeacherAssignment[];
  created_at: string;
}

export interface TeacherAssignment {
  id: string;
  employee_id: string;
  class_id: string;
  section_id?: string;
  subject_id: string;
  session_id: string;
  is_class_teacher: number;
  class_name?: string;
  section_name?: string;
  subject_name?: string;
  session_name?: string;
}

export interface AcademicSession {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: number;
}

export interface Term {
  id: string;
  session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: number;
  session_name?: string;
}

export interface Class {
  id: string;
  branch_id?: string;
  name: string;
  numeric_name?: number;
  description?: string;
  capacity?: number;
  sort_order: number;
  is_active: number;
  branch_name?: string;
  student_count?: number;
}

export interface Section {
  id: string;
  class_id: string;
  name: string;
  capacity?: number;
  is_active: number;
  class_name?: string;
  student_count?: number;
}

export interface Subject {
  id: string;
  branch_id?: string;
  name: string;
  code?: string;
  description?: string;
  type: string;
  is_active: number;
  branch_name?: string;
}

export interface Department {
  id: string;
  branch_id?: string;
  name: string;
  description?: string;
  head_id?: string;
  is_active: number;
  branch_name?: string;
  employee_count?: number;
}

export interface Designation {
  id: string;
  name: string;
  description?: string;
}

export interface Institution {
  id: string;
  name: string;
  code?: string;
  logo?: string;
  mobile?: string;
  address?: string;
  email?: string;
  website?: string;
  country: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  motto?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardStats {
  total_students: number;
  total_teachers: number;
  total_employees: number;
  total_parents: number;
  total_classes: number;
  total_branches: number;
}

export interface InstitutionContext {
  id: string;
  name: string;
  code: string;
}
