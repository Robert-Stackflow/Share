import {
  Building2,
  GitBranch,
  KeyRound,
  MessageCircle,
  Search,
} from "lucide-react";
import React from "react";
import api from "../services/api.service";

const getOAuthUrl = (appUrl: string, provider: string) => {
  return `${appUrl}/api/oauth/auth/${provider}`;
};

const getOAuthIcon = (provider: string) => {
  return {
    google: <Search />,
    microsoft: <Building2 />,
    github: <GitBranch />,
    discord: <MessageCircle />,
    oidc: <KeyRound />,
  }[provider];
};

const unlinkOAuth = (provider: string) => {
  return api.post(`/oauth/unlink/${provider}`);
};

export { getOAuthUrl, getOAuthIcon, unlinkOAuth };
