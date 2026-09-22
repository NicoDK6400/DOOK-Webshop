import nodemailer from 'nodemailer';
// Best-effort SMTP sending: a mail outage must never break checkout or login.
// Configured from the customer's own SMTP access (SMTP_HOST/PORT/USER/PASS/FROM).
let transport=null;
function getTransport(){
 if(transport!==null)return transport;
 if(!process.env.SMTP_HOST){console.warn('SMTP_HOST not set — emails will be skipped.');return transport=false}
 transport=nodemailer.createTransport({
  host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT)||587,
  secure:process.env.SMTP_SECURE==='true',
  auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined
 });
 return transport;
}
export async function sendMail({to,subject,text}){
 const client=getTransport();
 if(!client)return false;
 try{await client.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,subject,text});return true}
 catch(error){console.error('sendMail failed',error.message);return false}
}
const money=(amount,currency)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'DKK'}).format(amount);
export async function sendOrderConfirmationEmail(order){
 if(!order?.email)return;
 const lines=order.lines.map(l=>`${l.qty} × ${l.model} · ${l.colour} · ${l.size} — ${money(l.unitPrice*l.qty,order.currency)}`).join('\n');
 await sendMail({
  to:order.email,
  subject:`DOOK order confirmation`,
  text:`Thank you for your order.\n\n${lines}\n\nTotal: ${money(order.total,order.currency)} (${order.tax})\n\nDelivery address:\n${order.delivery}\n\nWe will confirm availability and follow up shortly.\n\nDOOK Denmark`
 });
}
export async function sendPasswordResetEmail(email,resetUrl){
 await sendMail({
  to:email,
  subject:'Reset your DOOK password',
  text:`Use this link to choose a new password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.`
 });
}
