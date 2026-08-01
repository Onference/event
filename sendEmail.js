import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'email-smtp.us-east-1.amazonaws.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendRegistrationEmail(toEmail, name = "") {
  try {
      await transporter.sendMail({ 
      from: `"Onference" <${process.env.FROM_EMAIL}>`,
      to: toEmail,
      subject: "Denma Masterclass Registration Successful",
      text: `Welcome ${name}! You are successfully registered for Denma Masterclass. Thank you for registering.`,
      html: `
        <h2>Welcome ${name}!</h2>
        <p>You are successfully registered for Denma Masterclass.</p>
        <p>Thank you for registering.</p>
      `,
    });

  } catch (error) {
    console.error("Error sending Email via Nodemailer : ", error);
    throw error;
  }
}