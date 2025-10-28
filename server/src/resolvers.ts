import { GraphQLError } from 'graphql';

export const resolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      const auth = context.auth;
      if (!auth || !auth.userId) return null;
      return {
        id: auth.userId,
        email: auth.userIdentifier ?? null,
        displayName: auth.userFullName ?? null,
      };
    },
  },

  Mutation: {
    createBoard: async (_: any, { title }: any, context: any) => {
      const auth = context.auth;
      if (!auth || !auth.userId) {
        throw new GraphQLError('You must be signed in to create a board.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      const userId = auth.userId;
      const fakeId = 'board_' + Date.now();
      console.log(`User ${userId} created board: ${title}`);
      return fakeId;
    },
  },
};
