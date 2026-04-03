if (!process.env.FIELD_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY.trim().length === 0) {
  process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key";
}
