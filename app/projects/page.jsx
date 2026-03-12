"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectsScreen from "@/components/ProjectsScreen";
import LoginScreen from "@/components/LoginScreen";
import { Loader2 } from "lucide-react";

const STORAGE_TOKEN_KEY = "sherlock_access_token";
const STORAGE_USER_KEY = "sherlock_user";

async function fetchUserInfo(token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

export default function ProjectsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [user, setUser] = useState(null);
  const [tokenClient, setTokenClient] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const persistSession = useCallback(async (token) => {
    setAccessToken(token);
    sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
    const userInfo = await fetchUserInfo(token);
    if (userInfo) {
      setUser(userInfo);
      sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userInfo));
    }
    router.push("/projects");
  }, [router]);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(STORAGE_TOKEN_KEY);
    if (!savedToken) {
      setAuthChecked(true);
      router.replace("/");
      return;
    }

    fetchUserInfo(savedToken).then((info) => {
      setAuthChecked(true);
      if (info) {
        setAccessToken(savedToken);
        const savedUser = sessionStorage.getItem(STORAGE_USER_KEY);
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            setUser(info);
          }
        } else {
          setUser(info);
        }
      } else {
        sessionStorage.removeItem(STORAGE_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_USER_KEY);
        router.replace("/");
      }
    });
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2 && !tokenClient) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
          callback: (tokenResponse) => {
            if (tokenResponse?.access_token) {
              persistSession(tokenResponse.access_token);
            }
          }
        });
        setTokenClient(client);
        clearInterval(interval);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [clientId, tokenClient, persistSession]);

  const handleLogin = () => {
    if (!tokenClient) return;
    tokenClient.requestAccessToken({ prompt: "" });
  };

  const handleLogout = () => {
    setAccessToken("");
    setUser(null);
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_USER_KEY);
    if (window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    router.replace("/");
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!accessToken) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <ProjectsScreen user={user} onLogout={handleLogout} />;
}
