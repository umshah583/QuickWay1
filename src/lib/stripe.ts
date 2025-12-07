import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key ? new Stripe(key, {
  apiVersion: "2025-10-29.clover",
}) : null;

export default stripe;
