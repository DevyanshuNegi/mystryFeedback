import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/dbConnect';
import UserModel from '@/model/User';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      // id is not there in docs but used mostly.
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      // this function is very imp otherwise throw error
      async authorize(credentials: any): Promise<any> {
        await dbConnect();
        try {
          const user = await UserModel.findOne({
            $or: [
              { email: credentials.identifier },
              { username: credentials.identifier },
            ],
          });
          if (!user) {
            throw new Error('No user found with this email');
          }
          if (!user.isVerified) {
            throw new Error('Please verify your account before logging in');
          }
          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );
          if (isPasswordCorrect) {
            return user; // return user or error
          } else {
            throw new Error('Incorrect password');
          }
        } catch (err: any) {
          //NOTE: here throwig error is very important or return null;
          throw new Error(err);
        }
      },
    }),
  ],
  callbacks: {
    // NOTE: here customising callbacks is must
    // strictly follow docs and reutrn as specified in callbacks  
    // like reutrn token for jwt, return sesion for session, return baseUrl for redirect

    // here we only modify jwt and session but why ?
    // 
    async jwt({ token, user }) {
      // Making our token more powerfull
      // here the user is the one which is returned by the previous function
      if (user) {
        // NOTE: here we try to put max data into the token 
        // this could increase payload size but will prevent many db calls

        token._id = user._id?.toString(); // Convert ObjectId to string
        // here user._id will give error because ts only know about the basic user of next
        // So we need to declare our user inside the types types folder  
        token.isVerified = user.isVerified;
        token.isAcceptingMessages = user.isAcceptingMessages;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user._id = token._id;
        session.user.isVerified = token.isVerified;
        session.user.isAcceptingMessages = token.isAcceptingMessages;
        session.user.username = token.username;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    // NOTE: this is to override sign-in aroute or api 
    // this will be handeled and made by next auth only
    signIn: '/sign-in',
  },
};
