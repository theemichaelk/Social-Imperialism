require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });
const nodemailer = require('nodemailer');

(async () => {
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  for (const from of ['michaelk@tsbrenterprises.com', 'theesaintmichael@gmail.com']) {
    try {
      const info = await t.sendMail({
        from: `"Social Imperialism" <${from}>`,
        to: 'theesaintmichael@gmail.com',
        subject: `SES test from ${from}`,
        html: '<p>SES live test</p>',
      });
      console.log(from, 'PASS', info.messageId);
    } catch (e) {
      console.log(from, 'FAIL', e.message.slice(0, 160));
    }
  }
})();