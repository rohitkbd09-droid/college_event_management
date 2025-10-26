# College Event Management System

A web application for managing college fest events, registrations, and administrative tasks.

## Deploying to Vercel

### Prerequisites
1. Node.js and npm installed on your computer
2. A Vercel account (sign up at vercel.com)
3. Vercel CLI installed (optional, for local development)
   ```bash
   npm install -g vercel
   ```

### Deployment Steps

1. Install Vercel CLI and login:
   ```bash
   npm install -g vercel
   vercel login
   ```

2. Configure Environment Variables in Vercel:
   Go to your Vercel dashboard and set these environment variables:
   ```
   DB_HOST=your_database_host
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   DB_NAME=your_database_name
   EMAIL_USER=your_email
   EMAIL_PASSWORD=your_email_app_password
   JWT_SECRET=your_secure_jwt_secret
   ```

3. Deploy to Vercel:
   ```bash
   vercel
   ```

   Or for production:
   ```bash
   vercel --prod
   ```

### Database Setup

1. Set up a MySQL database:
   - Use a cloud MySQL provider (e.g., PlanetScale, AWS RDS, or Google Cloud SQL)
   - Update the database connection details in Vercel environment variables

2. The application will automatically create required tables on first run

### Important Notes

1. Make sure your MySQL database allows connections from Vercel's IP ranges
2. The JWT_SECRET should be a secure random string in production
3. Email credentials should be app-specific passwords for Gmail

## Deployment to TinyHost

### Prerequisites
1. Create an account on TinyHost
2. Install TinyHost CLI (if available)
3. Have Node.js and npm installed locally

### Environment Variables
Before deploying, make sure to set up the following environment variables in your TinyHost dashboard:

```
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_SSL_CA=your_ssl_certificate_if_needed
DB_ALLOW_UNAUTHORIZED=true_or_false
EMAIL_USER=your_email
EMAIL_PASSWORD=your_email_app_password
JWT_SECRET=your_jwt_secret
PORT=3000
CORS_ORIGIN=*
```

### Deployment Steps

1. Install TinyHost CLI (if available):
   ```bash
   npm install -g tinyhost-cli
   ```

2. Login to TinyHost:
   ```bash
   tinyhost login
   ```

3. Initialize TinyHost in your project (if not already done):
   ```bash
   tinyhost init
   ```

4. Deploy your application:
   ```bash
   tinyhost deploy
   ```

### Manual Deployment

If TinyHost CLI is not available:

1. Zip your project files (excluding node_modules and .env):
   ```bash
   git archive -v -o deploy.zip HEAD
   ```

2. Upload the zip file through TinyHost's web interface

3. Configure environment variables in TinyHost's dashboard

4. Deploy your application using TinyHost's web interface

### Post-Deployment

1. Set up your database:
   - Create a database in your preferred MySQL hosting service
   - Update the database connection details in TinyHost's environment variables

2. Configure domain (if needed):
   - Add your custom domain in TinyHost's dashboard
   - Configure DNS settings as per TinyHost's instructions

3. Verify your deployment:
   - Check if the application is running
   - Test all major functionalities
   - Verify database connections
   - Test email functionality

### Troubleshooting

1. If the application fails to start:
   - Check the logs in TinyHost dashboard
   - Verify all environment variables are set correctly
   - Ensure database connection is working

2. If database connection fails:
   - Check if database credentials are correct
   - Verify if database host is accessible from TinyHost
   - Check if database user has proper permissions

3. If emails are not sending:
   - Verify email credentials in environment variables
   - Check if email service (Gmail) is accessible
   - Verify if email app password is correct

### Monitoring

- Monitor your application's performance through TinyHost's dashboard
- Check error logs regularly
- Monitor database connections and performance
- Keep track of email delivery status

### Maintenance

1. Regular updates:
   ```bash
   git pull
   npm update
   tinyhost deploy
   ```

2. Database backups:
   - Set up regular database backups
   - Keep backup copies in a secure location

3. Security:
   - Regularly update dependencies
   - Monitor for security vulnerabilities
   - Keep environment variables secure
   - Regularly rotate JWT secrets and passwords
