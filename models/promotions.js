const { Schema, model } = require('mongoose');
const payments = require('./payments');
const users = require('./users');
const crypto = require('crypto');

const Promotion = new Schema(
  {
    value: {
      type: String,
      required: true,
      unique: true
    },
    created: {
      type: Date,
      default: () => new Date()
    },
    amount: {
      type: Number,
      required: true
    },
    durability: {
      type: Number,
      default: 1,
      min: 1
    },
    uses: {
      type: Number,
      default: 0
    }
  },
  {
    methods: {
      async usePromo(user) {
        if (this.uses >= this.durability) {
          return 'число использований промокода исчерпано';
        }

        const check = await payments.exists({
          user,
          promo: this.value
        });
        if (check) {
          return 'промокод уже был использован';
        }

        await promotions.updateOne(
          {
            _id: this._id
          },
          {
            $inc: {
              uses: 1
            }
          }
        );

        const paymentID = await genPaymentID();
        const payment = await payments.create({
          amount: this.amount,
          service: 'promo',
          promo: this.value,
          user,
          paymentID,
          status: 'paid'
        });

        await users.updateOne(
          {
            telegramID: user
          },
          {
            $inc: {
              balance: payment.amount
            }
          }
        );

        return payment.amount || 'не удалось активировать промокод';
      }
    }
  }
);

async function genPaymentID() {
  const id = crypto.randomInt(999999999 - 10000000);
  const check = await payments.exists({
    paymentID: id
  });

  if (check) {
    return await genPaymentID();
  } else return id;
}

const promotions = model('promotions', Promotion);
module.exports = promotions;
