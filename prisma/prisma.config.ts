const config = {
  datasources: {
    db: {
      adapter: 'postgres',
      url: process.env.DATABASE_URL,
    },
  },
};

export default config;
