# Email Verification Setup

This document outlines the email verification process for the IT Asset Management Portal.

## 1. Database Setup

In Back4App, ensure the following columns exist in the `_User` class:

- `emailVerified` (Boolean): Indicates if the user's email has been verified
- `emailVerificationToken` (String): Stores the token for link-based verification
- `emailVerificationTokenExpiresAt` (Date): Stores the expiration time for the token
- `verificationCode` (String): Stores the 6-digit verification code
- `codeExpiresAt` (Date): Stores the expiration time for the verification code

## 2. Email Service Setup

Configure Nodemailer in your Parse Server by adding the following to your Parse Server configuration:

```javascript
emailAdapter: {
  module: 'parse-server-simple-smtp-adapter',
  options: {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@example.com',
      pass: 'your-password'
    },
    tls: {
      rejectUnauthorized: false
    }
  }
}
```

## 3. Code-Based Verification Flow

1. When a user registers, a 6-digit verification code is generated and stored in the user object.
2. An email with the verification code is sent to the user using Nodemailer.
3. The user has 60 seconds to enter the code in the verification form.
4. A countdown timer is displayed to show the remaining time.
5. The app sends the code and email to Back4App for verification.
6. If valid, the `emailVerified` field is set to `true` in the user object.
7. If the timer expires, the user must request a new code.
8. The user can now log in with their credentials after successful verification.

## 4. Implementation Details

### Cloud Functions

- `sendVerificationCode`: Generates a 6-digit code, stores it in the user object, and sends it via email. The code expires after 60 seconds.
- `verifyEmailWithCode`: Verifies the provided code against the stored code and marks the email as verified if valid.

### Frontend Components

- The verification page includes a form for entering the verification code
- A countdown timer shows the remaining time (60 seconds)
- The form is automatically disabled when the timer expires
- Users can request a new code if needed
- The login process checks if the email has been verified before allowing access

## 5. Temporary Workaround for Email Issues

The code has been updated to handle email sending errors gracefully:

1. **Registration Will Complete**: Even if email sending fails, users can still register.
2. **Verification Codes in Logs**: The verification codes are logged in the Back4App logs with "IMPORTANT" prefix for easy searching.
3. **Manual Verification**: An admin can manually verify users with the `manuallyVerifyEmail` cloud function.

### Using the Manual Verification Tool

1. Open your application in a browser and log in as an admin.
2. Open the browser developer console (F12 or right-click > Inspect > Console).
3. Copy and paste the contents of `admin-tools.js` into the console.
4. Call the function with the user's email:
   ```javascript
   manuallyVerifyEmail('user@example.com').then(result => console.log(result))
   ```

## 6. Testing the Verification

1. Register a new user in your application.
2. You should see the verification code form with a 60-second countdown timer.
3. Check the Back4App logs for lines starting with "IMPORTANT" to find the verification code if email delivery fails.
4. Enter the code to verify the email before the timer expires.
5. Try logging in with the registered credentials.

## 7. Troubleshooting

- If emails are not being sent, check your Nodemailer configuration and logs.
- Make sure your SMTP server credentials are correct.
- If using Gmail, you might need to enable "Less secure app access" or use App Passwords.
- If verification fails, check the Back4App logs for error messages.
- Make sure the `FRONTEND_URL` is correctly set to match your application's URL.
- Ensure the email service API keys and configurations are correctly set.

## 8. Production Considerations

- Use a verified custom domain in Mailgun for better deliverability.
- Use a secure method to generate verification tokens.
- Set appropriate expiration times for verification tokens.
- Implement rate limiting for verification attempts.
- Remove the manual verification workaround once email sending is working properly. 