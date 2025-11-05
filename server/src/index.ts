import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt, { JwtPayload } from "jsonwebtoken";
import { GraphQLSchema } from "graphql";
import { createServer } from "http";
import { WebSocketServer } from "ws"; // <-- NEW: For WebSockets
import { useServer } from "graphql-ws/use/ws"; // <-- NEW: Adapter for subscriptions
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import mongoose from "mongoose";
import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from "./schema";
import { resolvers } from "./resolvers";
import { JWT_SECRET } from "./utils/config"; // For security
import { getUserFromToken } from "./utils/auth"; // For authentication logic
import { PubSub } from "graphql-subscriptions";
export const pubsub = new PubSub(); // <-- NEW: The global event broadcaster
// The main server setup function
async function startServer() {
  // --- 1. Database Connection ---
  // We'll use a placeholder for now. Replace with your actual MongoDB connection string.
  const MONGO_URI =
    process.env.MONGO_URI || "mongodb://localhost:27017/priority-huddle";

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB successfully.");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }

  // --- 2. Express App & Middleware ---
  const app = express();
  app.use(cors({ origin: ["http://localhost:5173"] })); // Allow our React client to connect

  // 1. Create a raw HTTP server to host both Express and the WebSocket server
  const httpServer = createServer(app); // <-- CHANGE
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  const wsServer = new WebSocketServer({
    server: httpServer, // Attach the WebSocket server to the same HTTP server
    path: "/graphql", // Use the same path as our HTTP endpoint
  });

  const serverCleanup = useServer(
    {
      schema,
      onConnect: async (ctx) => {
        // Log the incoming connection params for debugging
        try {
          console.log("WS onConnect - connectionParams:", ctx.connectionParams);
        } catch (e) {
          // ignore
        }

        // Support both 'authToken' (legacy) and 'authorization' (Bearer <token>)
        const rawAuthToken = ctx.connectionParams?.authToken as
          | string
          | undefined;
        const rawAuthorization = ctx.connectionParams?.authorization as
          | string
          | undefined;

        const tokenFromAuth = rawAuthToken;
        const tokenFromAuthorization = rawAuthorization
          ? rawAuthorization.split(" ")[1]
          : undefined;

        const token = tokenFromAuth || tokenFromAuthorization;

        if (!token) {
          console.warn("WS Rejected: No token provided in connectionParams.");
          return false;
        }

        try {
          // Verify token quickly here to fail fast on bad tokens
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          // Attempt to resolve the user via existing helper (expects 'Bearer <token>')
          const user = await getUserFromToken(`Bearer ${token}`);

          if (!user) {
            console.warn("WS Rejected: User not found for token.");
            return false;
          }

          // Attach the user to ctx.extra for the context resolver below
          (ctx.extra as any).user = user;
          console.log(
            "WS Accepted for user:",
            user.username || user.id || user._id
          );
          return true; // Connection ACCEPTED
        } catch (err) {
          console.error("WS Rejected: Invalid JWT.", (err as Error).message);
          return false; // Connection REJECTED
        }
      },

      // 2. Pass the authenticated user to the subscription context
      context: async (ctx) => {
        // Retrieve the user attached during onConnect
        const user = (ctx.extra as any).user;

        return {
          user, // <-- This user object is now available to your subscription filter
          JWT_SECRET,
          pubsub,
        };
      },
    },
    wsServer
  );
  const apolloServer = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apolloServer.start();

  // --- 4. Context Function (Crucial for Auth) ---
  // The context function runs on every GraphQL request.
  // It checks for the JWT in the headers and attaches the logged-in user to the request context.
  const contextFunction = async ({
    req,
    res,
  }: {
    req: express.Request;
    res: express.Response;
  }) => {
    // 1. Get the JWT from the Authorization header
    const token = req.headers.authorization || "";

    // 2. Resolve the user based on the token
    const user = await getUserFromToken(token);

    // 3. Return the context object, making the user available to ALL resolvers
    return {
      // Data Sources will go here later (e.g., a function to fetch Notes)
      user,
      JWT_SECRET,
      pubsub,
    };
  };

  // --- 5. Apply Apollo Middleware to Express ---
  app.use(
    "/graphql",
    express.json(),
    expressMiddleware(apolloServer, {
      context: contextFunction,
    })
  );

  // --- 6. Start the Express Server ---
  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`📡 Subscriptions ready at ws://localhost:${PORT}/graphql`);
  });
}

startServer();
