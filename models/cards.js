const { Schema, model, Types, SchemaTypes, trusted } = require("mongoose");
const { z } = require("zod");
const cardTransactions = require("./cards-transactions");

const Currencies = z.union([
  z.literal("USD"),
  z.literal("UAH"),
  z.literal("EUR"),
]);

const TransactionParams = z.object({
  issuer: z.number(),
  amount: z.number(),
  currency: Currencies,
  sendToHold: z.boolean().optional().default(false),
  description: z.string().optional(),
  busy: z.boolean().optional(),
  order: z.number().optional(),
  success: z.boolean().optional().default(true),
  cardBalance: z.number(),
});

const CardSchema = new Schema(
  {
    number: {
      type: String,
      required: true,
      unique: true,
    },
    cvc: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      validate: /((0[1-9])|(1[0-2]))\/([2,3][0-9])/,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      enum: ["USD", "EUR", "UAH"],
    },
    hidden: {
      type: Boolean,
      required: true,
      default: false,
    },
    busy: {
      type: Boolean,
      required: true,
      default: false,
    },
    hold: {
      type: Date,
      default: () => new Date(Date.now() - 60000),
    },
    added: {
      type: Date,
      default: Date.now,
    },
    bank: {
      type: String,
      required: true,
    },
    cardholder: {
      type: String,
      required: true,
    },
    category: SchemaTypes.ObjectId,
  },
  {
    methods: {
      createTransaction: async (card, params) => {
        try {
          const {
            cardBalance,
            amount,
            currency,
            issuer,
            sendToHold,
            description,
            busy,
            order,
            success,
          } = TransactionParams.parse(params);

          if (amount === 0) {
            return null;
          }

          const increase = success ? amount : 0;

          const result = await cards.findByIdAndUpdate(card, {
            $set: {
              hold: sendToHold ? new Date(Date.now() + 86400000) : undefined,
              busy,
            },
            $inc: {
              balance: increase,
            },
          });

          if (result.modifiedCount === 0) {
            throw new Error("Ошибка во время обновления карты");
          }

          const balanceAfter = cardBalance + (success ? amount : 0);
          const transaction = await cardTransactions.create({
            amount,
            currency,
            description,
            card,
            issuer,
            orderId: order,
            success,
            balanceAfter,
          });

          return transaction;
        } catch (error) {
          console.log(error);
          return null;
        }
      },
    },
  }
);

const cards = model("cards", CardSchema);
module.exports = cards;
