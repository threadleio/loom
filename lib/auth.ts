import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { displayNameFromEmail } from "./sso";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "guest",
      name: "Guest",
      credentials: {
        displayName: { label: "Display Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.displayName) return null;

        const user = await prisma.user.create({
          data: {
            displayName: credentials.displayName,
            isGuest: true,
            role: "participant",
          },
        });

        return { id: user.id, name: user.displayName, email: null, role: user.role };
      },
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return { id: user.id, name: user.displayName, email: user.email, role: user.role };
      },
    }),
    CredentialsProvider({
      id: "sso",
      name: "Company SSO",
      credentials: {
        email: { label: "Corporate Email", type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email || !email.includes("@")) return null;

        // Mocked SSO: any corporate email resolves to a host identity,
        // mapping the token's identity into the database (find-or-create).
        const displayName = displayNameFromEmail(email);
        const existing = await prisma.user.findUnique({ where: { email } });
        const user = existing
          ? await prisma.user.update({
              where: { email },
              data: { displayName, isGuest: false, role: "host" },
            })
          : await prisma.user.create({
              data: { email, displayName, isGuest: false, role: "host" },
            });

        return { id: user.id, name: user.displayName, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
