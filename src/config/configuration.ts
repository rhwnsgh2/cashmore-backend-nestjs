export default () => ({
  port: parseInt(process.env.PORT ?? '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: process.env.SUPABASE_JWT_SECRET,
  },
  gcs: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
  },
});
