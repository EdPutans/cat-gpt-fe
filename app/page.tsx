"use client";

import type React from "react";
import Markdown from "react-markdown";

import SourceList from "@/components/SourceList";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hostIp } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export type MetadataEntry = {
  url?: string;
  title?: string;
};

interface Message {
  role: "user" | "assistant";
  content: string;
  id?: string;
  toolCalls?: {
    id: string;
    name: string;
    output: string;
    type: string;
  }[];
}

export default function ChatBot() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedId = localStorage.getItem("conversationId");

    if (storedId) {
      setConversationId(storedId);
      fetchChatHistory(storedId);
      return;
    }

    // Generate a conversation ID if one doesn't exist
    const newId = `thread-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 12)}`;
    setConversationId(newId);
    localStorage.setItem("conversationId", newId);
  }, []);

  const fetchChatHistory = async (id: string) => {
    try {
      const response = await fetch(
        `${hostIp}/chat/history/${id}?showToolCalls=true`,
        {
          method: "GET",
          mode: "cors",
          credentials: "omit",
        }
      );

      if (response.ok) {
        const data: Message[] = await response.json();

        setMessages(data);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    setIsLoading(true);

    // Add user message to UI immediately
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const response = await fetch(`${hostIp}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          conversationId,
        }),
        credentials: "omit",
      });

      if (response.ok) {
        const data = await response.json();
        // Fetch updated chat history after sending message
        await fetchChatHistory(conversationId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Error sending message. Please try again.");
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const extractSourceFromMessage = (message: Message) => {
    try {
      const toolCall = message.toolCalls?.[0];

      if (!toolCall) {
        console.log("no toolcall. out", message.content);
        return [null];
      }

      const parsedOutput = JSON.parse(toolCall.output) as {
        context: MetadataEntry[];
      };

      if (!parsedOutput?.context) {
        console.log("no context. out", message.content);
        return [null];
      }

      console.log("parsing......", message);
      console.log({
        context: parsedOutput.context.map((item: any) => item.metadata),
      });

      const sourceEntries = parsedOutput.context.map((item: any) => {
        if (!item) return null;

        let result = {
          title: item?.title,
          url: item?.url,
        } as MetadataEntry;

        if (!result.url && !result.title) return null;

        return result;
      });

      if (sourceEntries.length === 0) return [null];

      const sources =
        sourceEntries.reduce(
          (acc: MetadataEntry[], item: MetadataEntry | null) => {
            if (!item) return acc;

            if (item) {
              const existing = acc.find((i) => i.url === item.url);
              if (!existing) {
                acc.push(item);
              }
            }

            return acc;
          },
          []
        ) || [];

      if (!sources.length) return [null];

      return <SourceList sources={sources} />;
    } catch (e) {
      return [null];
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-xl flex flex-col items-center gap-4">
        <div className="w-24 h-24 mt-8 ">
          <Image src={"/catgpt.png"} alt="" width={120} height={120} />
        </div>

        {/* <h1 className="text-2xl font-bold text-center">CatGPT</h1> */}

        <Card className="w-full">
          <CardHeader className="text-xs italic text-gray-500">
            Conversation ID: {conversationId}
          </CardHeader>
          <CardContent className="h-[60vh] overflow-y-auto space-y-4 p-4">
            {messages.length === 0 ? (
              <div className="flex items-center text-center justify-center h-full text-gray-400">
                This is the start of your conversation with the feline
                assistant.
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-gray-200 text-gray-800 rounded-tl-none"
                    }`}
                  >
                    <Markdown>{msg.content}</Markdown>

                    <br />
                    {extractSourceFromMessage(msg)}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg bg-gray-200 text-gray-800 rounded-tl-none flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <form onSubmit={handleSubmit} className="w-full flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
