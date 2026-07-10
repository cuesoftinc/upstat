import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { authenticateWithBackend } from "@/lib/auth-service";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && account.id_token) {
        try {
          const backendUser = await authenticateWithBackend(account.id_token);
          if (backendUser && backendUser.token) {
            user.id = backendUser.id;
            user.email = backendUser.email;
            user.name = backendUser.name;
            (user as any).backendToken = backendUser.token;
            return true;
          }
          return false;
        } catch (error) {
          console.error("Backend authentication failed:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.backendToken = (user as any).backendToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).backendToken = token.backendToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
});
