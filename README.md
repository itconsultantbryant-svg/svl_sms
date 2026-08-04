# SVL School Management System (SVL-SMS)

A comprehensive web-based School Management System built for Softwarevala Liberia.

## Features

### ✅ Phase 1: Admission Management
- Enquiry Management
- Application Processing
- Student Admission

### ✅ Phase 2: Academic Structure
- Academic Sessions & Terms
- Class & Section Management
- Subject Management
- Department & Designation Management

### ✅ Phase 3: Examination & Results
- Exam Type Management
- Grade Scale Configuration
- Exam Scheduling
- Marks Entry
- Result Generation & Publishing

### ✅ Phase 4: Fee Management
- Fee Type & Structure Management
- Invoice Generation
- Payment Processing
- Balance Tracking

### ✅ Phase 5: Staff Management
- Teacher/Employee Management
- Payroll System
- Leave Management
- Loan Management

### ✅ Phase 6: Library Management
- Book Cataloging
- Issue/Return Management
- Category Management

### ✅ Phase 7: Transport Management
- Vehicle Management
- Route Management
- Student Transport Assignment

### ✅ Phase 8: Communication & Reports
- Announcements
- SMS & Email Messaging
- Statistical Reports
- Analytics Dashboard

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT
- **Language**: TypeScript

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: TanStack Query
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Project Structure

```
svl_sms/
├── backend/          # Express.js backend API
│   ├── src/
│   │   ├── routes/   # API routes
│   │   ├── database/ # Database schema & initialization
│   │   ├── middleware/ # Auth & tenant middleware
│   │   └── utils/    # Helper functions
│   ├── data/         # SQLite database (not in git)
│   ├── render.yaml   # Render deployment config
│   └── package.json
│
├── frontend/         # React frontend application
│   ├── src/
│   │   ├── pages/    # Page components
│   │   ├── components/ # Reusable components
│   │   ├── contexts/ # React contexts
│   │   ├── utils/    # Utilities & API client
│   │   └── App.tsx
│   ├── vercel.json   # Vercel deployment config
│   └── package.json
│
├── DEPLOYMENT.md     # Deployment guide
└── README.md         # This file
```

## Installation & Setup

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

Backend will run on `http://localhost:3001`

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with backend URL
npm run dev
```

Frontend will run on `http://localhost:3000`

### Default Login Credentials
- **Username**: admin
- **Password**: admin123

⚠️ **Change these credentials immediately after first login!**

## Database Schema

The system uses a multi-tenant architecture with 98+ tables including:
- Users & Roles
- Institutions & Branches
- Students & Parents
- Teachers & Employees
- Classes & Subjects
- Exams & Results
- Fees & Payments
- Library & Transport
- And more...

## Multi-Tenant Architecture

Every database query is filtered by `institution_id` to ensure complete data isolation between schools/institutions. The system supports:
- Platform Admin (manages multiple institutions)
- Institution Admin (manages single institution)
- Role-based access control (RBAC)
- Branch-level data filtering

## API Documentation

### Authentication
```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Core Modules
- `/api/admission/*` - Admission management
- `/api/academics/*` - Academic structure
- `/api/examinations/*` - Exams & results
- `/api/fees/*` - Fee management
- `/api/teachers/*` - Staff management
- `/api/library/*` - Library system
- `/api/transport/*` - Transport management
- `/api/communication/*` - Messaging
- `/api/reports/*` - Reports & analytics

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy

**Backend (Render):**
1. Push to GitHub
2. Connect to Render
3. Deploy with `render.yaml`

**Frontend (Vercel):**
1. Push to GitHub
2. Connect to Vercel
3. Deploy with `vercel.json`

## Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Multi-tenant data isolation
- Password hashing (bcrypt)
- CORS protection
- SQL injection prevention (prepared statements)
- XSS protection

## Performance Optimizations

- Database indexes on frequently queried columns
- Paginated API responses
- Lazy loading of components
- Optimized SQL queries
- React Query caching

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

This is a private project for Softwarevala Liberia. Contact the administrator for contribution guidelines.

## License

Proprietary - All rights reserved by Softwarevala Liberia

## Support

For technical support or issues:
- Email: support@softwarevala.com
- Repository Issues: https://github.com/itconsultantbryant-svg/svl_sms/issues

## Version History

### v1.0.0 (2026-08-04)
- Initial release
- All 8 phases completed
- Production-ready deployment

## Acknowledgments

Built with ❤️ by Softwarevala Development Team

---

**SVL School Management System** - Empowering Education Through Technology
