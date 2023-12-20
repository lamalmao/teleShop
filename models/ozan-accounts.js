const { Schema, model, SchemaTypes } = require('mongoose');
const { z } = require('zod');
const ozanTransactions = require('./ozan-transactions');

const OzonTransactionParams = z.object({
  order: z.number().optional(),
  description: z.string(),
  amount: z.number(),
  success: z.boolean().default(true),
  issuer: z.number()
});

const OzanAccount = new Schema(
  {
    employer: {
      type: Number,
      required: true
    },
    balance: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    methods: {
      createTransaction: async function (data) {
        try {
          const params = OzonTransactionParams.parse(data);
          const { order, description, amount, success, issuer } = params;

          const transaction = await ozanTransactions.create({
            account: this._id,
            amount,
            order,
            description,
            success,
            issuer
          });

          if (!transaction) {
            throw new Error('OZAN Transaction creation failed');
          }

          if (success) {
            await ozanAccounts.updateOne(
              {
                _id: this._id
              },
              {
                $inc: {
                  balance: amount
                }
              }
            );
          }

          return transaction;
        } catch (error) {
          console.log(error);
          return null;
        }
      }
    }
  }
);

const ozanAccounts = model('ozan-accounts', OzanAccount);
module.exports = ozanAccounts;
