const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'global',
    unique: true,
    immutable: true
  },

  laborRate: {
    type: Number,
    required: [true, 'Labor rate is required'],
    default: 50,
    min: [0, 'Labor rate cannot be negative']
  },

  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save: update timestamp
SettingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Get the global settings singleton (find-or-create)
 */
SettingSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ key: 'global' });
  if (!settings) {
    settings = await this.create({ key: 'global' });
  }
  return settings;
};

/**
 * Update the global labor rate
 */
SettingSchema.statics.updateLaborRate = async function(rate, updatedBy) {
  if (rate < 0) {
    const err = new Error('Labor rate cannot be negative');
    err.name = 'ValidationError';
    throw err;
  }

  const settings = await this.findOneAndUpdate(
    { key: 'global' },
    {
      laborRate: rate,
      updatedBy: updatedBy || 'system',
      updatedAt: new Date()
    },
    { new: true, upsert: true, runValidators: true }
  );

  return settings;
};

module.exports = mongoose.model('Setting', SettingSchema);
