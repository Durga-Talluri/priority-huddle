import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type User {
    id: ID!
    email: String
    displayName: String
  }

  type Query {
    me: User
  }

  type Mutation {
    createBoard(title: String!): ID!
  }
`;
