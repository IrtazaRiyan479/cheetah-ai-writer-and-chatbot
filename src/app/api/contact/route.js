import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const { name, email, message } = await request.json();

    let transporter;

    // 1. Check if we are running locally or on Hostinger
    if (process.env.NODE_ENV === 'production') {
      // 🟢 PRODUCTION (Hostinger): Uses your .env variables
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // 🛠️ LOCAL TESTING (Localhost): Creates a temporary fake account
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("Testing locally with Ethereal Email...");
    }

    // 2. Set up the email data
    const mailOptions = {
      from: process.env.NODE_ENV === 'production' ? process.env.SMTP_USER : '"Test Sender" <test@example.com>',
      to: 'author@yourdomain.com', // Who should receive the email
      replyTo: email,
      subject: `New Contact Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    };

    // 3. Send the email and capture the info
    const info = await transporter.sendMail(mailOptions);

    // 4. If testing locally, print the link to view the fake email!
    if (process.env.NODE_ENV !== 'production') {
      console.log("✅ Message sent successfully!");
      console.log("👀 PREVIEW YOUR EMAIL HERE: %s", nodemailer.getTestMessageUrl(info));
    }

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error("Email Error:", error);
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}
