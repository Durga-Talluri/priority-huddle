import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink, // <-- IMPORTANT
} from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { SetContextLink } from "@apollo/client/link/context";
import { getMainDefinition } from "@apollo/client/utilities"; // <-- IMPORTANT
import { GraphQLWsLink } from "@apollo/client/link/subscriptions"; // <-- IMPORTANT
import { createClient } from "graphql-ws"; // <-- IMPORTANT
// Define the GraphQL endpoint URLs
const HTTP_URL = "http://localhost:4000/graphql";
const WS_URL = "ws://localhost:4000/graphql"; // Note the 'ws' protocol

// 1. Create the HTTP Link
const httpLink = new HttpLink({
  uri: HTTP_URL,
});

// 2. Auth Link: Adds the JWT token to the headers for HTTP requests
const authLink = new SetContextLink((prevContext) => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      ...prevContext.headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});
// 3. Create the WebSocket Link (for Subscriptions)
const wsLink = new GraphQLWsLink(
  createClient({
    url: WS_URL,
    // Add connection params to send the token with the initial WebSocket handshake
    connectionParams: () => {
      const token = localStorage.getItem("token");
      // Send both a simple authToken and a standard Authorization header
      // so the server can accept either format while we support both codepaths.
      return {
        authToken: token,
        authorization: token ? `Bearer ${token}` : undefined,
      };
    },
  })
);

// 4. Split Link: Directs traffic based on the operation type
const splitLink = ApolloLink.split(
  // The test function: true for Subscriptions, false for Queries/Mutations
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink, // <-- If the test is true (it's a subscription), use the WebSocket link
  authLink.concat(httpLink) // <-- If the test is false, use the Auth + HTTP link
);

// 5. Create the Apollo Client
const client = new ApolloClient({
  link: splitLink, // Use the merged, intelligent link
  cache: new InMemoryCache(),
});

// Component setup (assuming a standard structure)
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
