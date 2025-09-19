import cron from "node-cron";
import { prisma } from "../db/index.js";
import nodemailer from "nodemailer";


const sendEmailToBorrower = async (loan, daysLate) => {
  const transporter = nodemailer.createTransport({
    // host: "smtp.ethereal.email",
    // port: 587,
    service: 'gmail',
    // secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  // Wrap in an async IIFE so we can use await.
  const info = await transporter.sendMail({
    to: loan.borrower.email,
    subject: `Your loan is overdue by ${daysLate} days`,
    html: ` <p>Dear ${loan.borrower.fullName},</p>
            <p> Your loan with these details:</p>
            <ul>
              <li>Amount: <b>$${loan.totalPayable}</b></li>
              <li>Lender: <b>${loan.lender.fullName} (${loan.lender.email})</b></li>
              <li>Signed By: <b>${loan.signedBy}</b></li>
              <li>Payback Date: <b>${loan.paybackDate.toDateString()}</b></li>
            </ul>
            <p>Is overdue by <b>${daysLate}</b> days. Current health status: <b>${loan.health}</b>.</p>
            
            <p>Please take necessary actions to address this issue.</p>
            <p>If you have already made the payment, please disregard this message.</p>
            <p>Kindly reach out to us if you have any questions or concerns.</p>
            
            <p>Regards,</p>
            <p>LoanIt2Me Team</p>
            `,
    text: ` Dear ${loan.borrower.fullName},
            Your loan with these details:
            Amount: $${loan.totalPayable}
            Lender: ${loan.lender.fullName} (${loan.lender.email})
            Signed By: ${loan.signedBy}
            Payback Date: ${loan.paybackDate.toDateString()}
            Is overdue by ${daysLate} days. Current health status: ${loan.health}.
            Please take necessary actions to address this issue.
            If you have already made the payment, please disregard this message.
            Kindly reach out to us if you have any questions or concerns.
            Regards,
            LoanIt2Me Team
          `,
  });

  // console.log("Message sent:", info.messageId);
}

const sendEmailToLender = async (loan, daysLate) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    // secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });


  // Wrap in an async IIFE so we can use await.
  const info = await transporter.sendMail({
    to: loan.lender.email,
    // subject: `Your loan is overdue by ${daysLate} days`,
    subject: `Your borrower's loan is overdue by ${daysLate} days`,

    html: ` <p>Dear ${loan.lender.fullName},</p>
            <p> Your borrower's loan with these details:</p>  
            <ul>
              <li>Amount: <b>$${loan.totalPayable}</b></li>
              <li>Borrower: <b>${loan.borrower.fullName} (${loan.borrower.email})</b></li>
              <li>Signed By: <b>${loan.signedBy}</b></li>
              <li>Payback Date: <b>${loan.paybackDate.toDateString()}</b></li>
            </ul>
            <p>Is overdue by <b>${daysLate}</b> days. Current health status: <b>${loan.health}</b>.</p>
            <p> We have already contacted the borrower regarding this issue.</p>
            <p>Please take necessary actions to address this issue.</p>
            <p>If the borrower has already made the payment, please disregard this message.</p>
            <p>Kindly reach out to us if you have any questions or concerns.</p>
            <p>Regards,</p>
            <p>LoanIt2Me Team</p>
            `,

    text: ` Dear ${loan.lender.fullName},
            Your borrower's loan with these details:
            Amount: $${loan.totalPayable}
            Borrower: ${loan.borrower.fullName} (${loan.borrower.email})
            Signed By: ${loan.signedBy}
            Payback Date: ${loan.paybackDate.toDateString()}
            Is overdue by ${daysLate} days. Current health status: ${loan.health}.
            We have already contacted the borrower regarding this issue.
            Please take necessary actions to address this issue.
            If the borrower has already made the payment, please disregard this message.
            Kindly reach out to us if you have any questions or concerns.
            Regards,
            LoanIt2Me Team
          `,
  });

  // console.log("Message sent:", info.messageId);
}

// Runs every day at midnight
export const nodemailerJob = cron.schedule("0 0 * * *", async () => {

  try {
    console.log("Running loan status + health updater...");

    const now = new Date();

    // 1. Mark loans as OVERDUE if payback date passed
    const overdueLoans = await prisma.loan.findMany({
      where: {
        status: "FUNDED",
        paybackDate: { lt: now },
      },
    });

    for (let loan of overdueLoans) {
      let newHealth = "BEHIND";

      // Example logic for deeper health tracking
      const daysLate = Math.floor((now - loan.paybackDate) / (1000 * 60 * 60 * 24));
      if (daysLate > 30) newHealth = "DEFAULTED";
      else if (daysLate > 14) newHealth = "FAILING";
      else newHealth = "BEHIND";

      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: "OVERDUE",
          health: newHealth,
        },
      });
    }

    // console.log(`${overdueLoans.length} loans updated as OVERDUE with health check.`);





    console.log("Running... nodemailer cron");

    // 2. Send email notifications for OVERDUE loans
    const loans = await prisma.loan.findMany({
      where: { status: "OVERDUE" },
      include: {
        lender: true,
        borrower: true
      }
    });

    // console.log("loans", loans);


    loans.forEach(loan => {

      const daysLate = Math.floor((now - loan.paybackDate) / (1000 * 60 * 60 * 24));

      sendEmailToBorrower(loan, daysLate)
      sendEmailToLender(loan, daysLate)
    });

    // console.log(`${loans.length} overdue loan emails sent.`);


  } catch (err) {
    console.error("Error in cron job:", err);
  }
});
