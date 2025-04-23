const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
    serviceType: {
        type: String,
        required: true
    },
    drops: {
        type: Number,
        required: true
    },
    construction: {
        type: Boolean,
        required: true
    },
    atticCrawl: {
        type: Boolean,
        required: true
    },
    ip: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Quote', QuoteSchema);