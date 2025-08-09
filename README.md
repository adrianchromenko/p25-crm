# P25-CRM - Hosting Client Management System

A modern React-based CRM system designed specifically for web development agencies managing hosting clients. Built with TypeScript, Firebase, and a beautiful modern UI.

![P25-CRM Dashboard](https://img.shields.io/badge/React-18.2.0-blue)
![Firebase](https://img.shields.io/badge/Firebase-v9-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9-blue)

## 🚀 Features

### 🏢 **Customer Management**
- Manage hosting clients with complete contact information
- Track multiple websites per customer
- Visual status indicators for payment coverage
- Search across customers and websites
- Notes and custom fields for each client

### 🌐 **Website Tracking**
- Multiple websites per customer with individual hosting plans
- Monthly fee tracking per website
- Status management (Active, Suspended, Cancelled)
- Visual indicators for payment status:
  - 🔴 **Expired**: Payment overdue
  - 🟡 **Expiring Soon**: Payment due within 7 days
  - 🟢 **Current**: Payment coverage active

### 💳 **Payment Management**
- Detailed payment tracking with coverage periods
- Link payments to specific websites or customers
- Multiple payment methods support
- Payment status tracking (Paid, Pending, Failed)
- Invoice number tracking
- Complete payment history per customer

### 📊 **Dashboard & Analytics**
- Overview of total customers and active subscriptions
- Monthly revenue calculations
- Recent activity tracking
- Visual statistics cards

### 🔐 **Security & Authentication**
- Firebase Authentication with admin access
- Protected routes requiring authentication
- Secure data storage with Firestore
- Environment-based configuration

## 🛠️ Technology Stack

- **Frontend**: React 18 with TypeScript
- **UI Framework**: Custom CSS with modern design system
- **Icons**: Lucide React
- **Backend**: Firebase (Authentication + Firestore)
- **Routing**: React Router DOM
- **Date Handling**: date-fns
- **Build Tool**: Create React App

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Authentication and Firestore enabled
- Git for version control

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/p25-crm.git
   cd p25-crm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication with Email/Password
   - Create a Firestore database
   - Copy your Firebase configuration

4. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_api_key_here
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id_here
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
   REACT_APP_FIREBASE_APP_ID=your_app_id_here
   ```

5. **Configure Firestore Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

6. **Create Admin User**
   - Go to Firebase Console → Authentication → Users
   - Add a user with your admin email and password

## 🚀 Running the Application

### Development
```bash
npm start
```
The app will open at `http://localhost:3000`

### Production Build
```bash
npm run build
```

### Testing
```bash
npm test
```

## 🌐 Deployment

### Render Deployment

1. **Push to GitHub** (this repository)

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Static Site"
   - Connect your GitHub repository

3. **Configure Build Settings**
   - **Build Command**: `npm run build`
   - **Publish Directory**: `build`

4. **Set Environment Variables** in Render:
   ```
   REACT_APP_FIREBASE_API_KEY
   REACT_APP_FIREBASE_AUTH_DOMAIN
   REACT_APP_FIREBASE_PROJECT_ID
   REACT_APP_FIREBASE_STORAGE_BUCKET
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID
   REACT_APP_FIREBASE_APP_ID
   ```

5. **Deploy**
   - Click "Create Static Site"
   - Render will automatically build and deploy your app

## 📱 Usage

1. **Login**: Use your Firebase admin credentials
2. **Add Customers**: Create customer profiles with contact information
3. **Manage Websites**: Add multiple websites per customer with hosting details
4. **Track Payments**: Record payments and set coverage periods
5. **Monitor Status**: Use visual indicators to track payment status
6. **View Analytics**: Check dashboard for business insights

## 🎨 UI Features

- **Modern Design**: Clean, professional interface
- **Responsive**: Works on desktop, tablet, and mobile
- **Dark Sidebar**: Professional navigation with icons
- **Color-Coded Status**: Visual indicators for quick reference
- **Modal Forms**: User-friendly data entry
- **Search Functionality**: Quick filtering and search
- **Smooth Animations**: Professional hover effects and transitions

## 🔒 Security

- Firebase Authentication for secure access
- Environment variables for sensitive configuration
- Protected routes requiring authentication
- Secure Firestore rules for data access
- No sensitive data in repository

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── Layout.tsx       # Main app layout
│   ├── Sidebar.tsx      # Navigation sidebar
│   ├── Login.tsx        # Authentication form
│   └── PrivateRoute.tsx # Route protection
├── pages/               # Main application pages
│   ├── Dashboard.tsx    # Analytics dashboard
│   ├── CustomersWithWebsites.tsx  # Customer management
│   ├── Payments.tsx     # Payment tracking
│   ├── Services.tsx     # Service management
│   └── Settings.tsx     # User preferences
├── context/             # React Context providers
│   └── AuthContext.tsx  # Authentication context
├── config/              # Configuration files
│   └── firebase.ts      # Firebase setup
├── types/               # TypeScript type definitions
│   └── index.ts         # Interface definitions
├── App.tsx              # Main application component
├── App.css              # Global styles
└── index.tsx            # Application entry point
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, create an issue in the GitHub repository.

## 🔮 Roadmap

- [ ] Advanced reporting and analytics
- [ ] Email notification system
- [ ] Automated invoice generation
- [ ] Client portal for self-service
- [ ] Integration with payment processors
- [ ] Backup and export functionality
- [ ] Multi-user support with roles

---

Built with ❤️ for web development agencies managing hosting clients.
