import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

const transporter = nodemailer.createTransport({
  host: 'email-smtp.us-east-1.amazonaws.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendRegistrationEmail(toEmail, name, salutation) {
  try {
   
    const filePath = path.join(process.cwd(),'Registration_Success_Email.html');
    let htmlTemplate = fs.readFileSync(filePath, 'utf8');

    htmlTemplate = htmlTemplate
      .replace(/{{Email}}/g, toEmail)
      .replace(/{{Salutation}}/g, salutation)
      .replace(/{{Full Name}}/g, name);

    await transporter.sendMail({ 
      from: `"Onference" <${process.env.FROM_EMAIL}>`,
      to: toEmail,
      subject: process.env.REGISTRATION_SUCCESS_EMAIL_SUBJECT,
      html: htmlTemplate,
    });

  } catch (error) {
    console.error("Error sending Email via Nodemailer : ", error);
    throw error;
  }
}