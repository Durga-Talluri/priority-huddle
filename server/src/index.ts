import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { clerkMiddleware } from '@clerk/express';

const PORT = process.env.PORT || 4000;

async function startServer() {
  // Initialize Apollo server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  // Create Express app
  const app = express();

  // Apply Clerk middleware early — attaches req.auth
  app.use(clerkMiddleware());

  // Standard middlewares
  app.use(cors());
  app.use(bodyParser.json());

  // Attach Apollo middleware, include Clerk auth in context
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        const auth = (req as any).auth || null;
        return { auth, req };
      },
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((err) => console.error(err));
