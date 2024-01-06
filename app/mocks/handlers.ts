import { http, HttpResponse, delay, graphql, passthrough } from 'msw';
import { graphql as executeGraphQL, buildSchema } from 'graphql';

const customerService = graphql.link('https://api.example.com/review-service');

const schema = buildSchema(`
type Movie {
  id: ID!
  title: String!
  slug: String!
  category: String!
  releasedAt: String!
  description: String!
  imageUrl: String!
}

type Review {
  id: ID!
  text: String!
  rating: Int!
  author: User!
}

type User {
  id: ID!
  firstName: String!
  avatarUrl: String!
}

input UserInput {
  id: ID!
  firstName: String!
  avatarUrl: String!
}

input ReviewInput {
  movieId: ID!
  text: String!
  rating: Int!
}

type Query {
  reviews(movieId: ID!): [Review!]
}

type Mutation {
  addReview(author: UserInput!, reviewInput: ReviewInput!): Review
}
`);
const reviews = [
  {
    id: '04be0fb5-19f6-411c-9257-bcef6cd203c2',
    text: 'One of my favorite films of all time.',
    rating: 5,
    author: {
      firstName: 'Kate',
      avatarUrl: 'https://i.pravatar.cc/100?img=1',
    },
  },
];

const movies = [
  {
    id: '8061539f-f0d6-4187-843f-a25aadf948eb',
    slug: 'the-shawshank-redemption',
    title: 'The Shawshank Redemption',
    category: 'Drama',
    releasedAt: new Date('1994-10-14'),
    description:
      'Over the course of several years, two convicts form a friendship, seeking consolation and, eventually, redemption through basic compassion.',
    imageUrl:
      'https://m.media-amazon.com/images/M/MV5BNDE3ODcxYzMtY2YzZC00NmNlLWJiNDMtZDViZWM2MzIxZDYwXkEyXkFqcGdeQXVyNjAwNDUxODI@._V1_FMjpg_UX1200_.jpg',
  },
  {
    id: '3342a4f2-144b-4cef-8041-676affedfbb8',
    slug: 'the-godfather',
    title: 'The Godfather',
    category: 'Drama',
    releasedAt: new Date('1972-03-24'),
    description:
      'Don Vito Corleone, head of a mafia family, decides to hand over his empire to his youngest son Michael. However, his decision unintentionally puts the lives of his loved ones in grave danger.',
    imageUrl:
      'https://m.media-amazon.com/images/M/MV5BM2MyNjYxNmUtYTAwNi00MTYxLWJmNWYtYzZlODY3ZTk3OTFlXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_FMjpg_UY1982_.jpg',
    reviews,
  },
  {
    id: 'b2b7e2d9-8b2e-4b7a-9b8a-7f9a0d7f7e0e',
    title: 'The Dark Knight',
    slug: 'the-dark-knight',
    category: 'Action',
    releasedAt: new Date('2008-07-18'),
    description:
      'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
    imageUrl:
      'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_FMjpg_UY2048_.jpg',
  },
];

export const handlers = [
  http.get('https://api.example.com/movies/featured', async () => {
    // console.log('Request happened!');
    // await delay(3000);

    return HttpResponse.json(movies);
  }),

  http.get('https://api.example.com/movies/:slug', ({ params }) => {
    const { slug } = params;

    const movie = movies.find((movie) => {
      return movie.slug === slug;
    });

    if (movie) {
      return HttpResponse.json(movie);
    }

    return new HttpResponse('Not found', { status: 404 });
  }),

  http.get('/api/recommendations', async ({ request }) => {
    const url = new URL(request.url);
    const movieId = url.searchParams.get('movieId');

    // await delay(); // random delay if no param
    // await delay('infinite'); // forever pending

    if (!movieId) {
      return HttpResponse.json(
        {
          error: 'Missingg queryy parameters "movieId"',
        },
        { status: 400 }
      );
    }

    // can alternate on mock data or original depending on requested resource
    if (movieId === '8061539f-f0d6-4187-843f-a25aadf948eb') {
      return passthrough(); // will perform this intercepted request as is. This means that the client will receive the original data.
    }

    if (movieId === 'b2b7e2d9-8b2e-4b7a-9b8a-7f9a0d7f7e0e') {
      return new HttpResponse(null, { status: 500 }); // message but json error :-(
      // return HttpResponse.json({}, { status: 500 }); // no json error, but no message
    }

    const recommendations = movies.filter((movie) => {
      return movie.id !== movieId;
    });
    return HttpResponse.json(recommendations.slice(0, 2));
  }),

  http.post('https://auth.provider.com/validate', async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');

    if (!email || !password) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      id: '1234',
      email,
      firstName: 'John',
      lastName: 'Maverick',
      avatarUrl: 'https://i.pravatar.cc/100?img=12',
    });
  }),

  // scoped handlers
  customerService.query('ListReviews', () => {
    return HttpResponse.json({
      data: {
        serviceReviews: [
          {
            id: '45e41b3e-etc-etc',
            message: 'Hello World',
          },
        ],
      },
    });
  }),

  graphql.operation(async ({ query, variables }) => {
    const { errors, data } = await executeGraphQL({
      schema,
      source: query,
      variableValues: variables,
      rootValue: {
        reviews(args) {
          const movie = movies.find((movie) => {
            return movie.id === args.movieId;
          });

          return movie?.reviews || [];
        },
        addReview(args) {
          const { author, reviewInput } = args;
          const { movieId, ...review } = reviewInput;

          const movie = movies.find((movie) => {
            return movie.id === movieId;
          });

          if (!movie) {
            throw new Error(`Cannot find a movie by ID "${movieId}"`);
          }

          const newReview = {
            ...review,
            id: Math.random().toString(16).slice(2),
            author,
          };

          const prevReviews = movie?.reviews || [];
          movie.reviews = prevReviews.concat(newReview);

          return newReview;
        },
      },
    });

    return HttpResponse.json({ errors, data });
  }),
];
