"use client";

import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";

export default function ConvexExample() {
  const { user } = useUser();
  const currentUser = useQuery(api.users.getCurrentUser);
  const upsertUser = useMutation(api.users.upsertUser);
  const userChats = useQuery(api.chats.getUserChats);

  // Auto-create user when they sign in
  React.useEffect(() => {
    if (user && !currentUser) {
      upsertUser({
        name: user.fullName || user.firstName || "Unknown",
        email: user.emailAddresses[0]?.emailAddress || "",
        avatar: user.imageUrl,
      });
    }
  }, [user, currentUser, upsertUser]);

  if (!user) {
    return <div>Please sign in to view your data.</div>;
  }

  return (
    <div className="p-4">
      <h1>Welcome to Kite with Convex + Clerk!</h1>
      
      {currentUser && (
        <div className="mb-4">
          <h2>Your Profile:</h2>
          <p>Name: {currentUser.name}</p>
          <p>Email: {currentUser.email}</p>
          {currentUser.avatar && (
            <img src={currentUser.avatar} alt="Avatar" className="w-12 h-12 rounded-full" />
          )}
        </div>
      )}

      <div>
        <h2>Your Chats ({userChats?.length || 0}):</h2>
        {userChats?.map((chat) => (
          <div key={chat._id} className="border p-2 mb-2">
            <h3>{chat.title}</h3>
            <p>{chat.messages.length} messages</p>
            <small>Created: {new Date(chat.createdAt).toLocaleDateString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
