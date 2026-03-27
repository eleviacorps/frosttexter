import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from "expo-local-authentication";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { StatusBar } from "expo-status-bar";

import type { Attachment, ChatMessage, Conversation } from "@frostchat/shared";

import { mobileApi } from "./src/lib/api";
import { uploadAttachment } from "./src/lib/media";
import { connectMobileSocket, emitMessage, emitStatus, emitTyping, joinConversation } from "./src/lib/socket";
import { useMobileStore } from "./src/store/useMobileStore";

const c = {
  bg: "#060607",
  panel: "rgba(12,13,16,0.92)",
  panelStrong: "#101216",
  panelSoft: "#15171d",
  border: "#1a2336",
  borderStrong: "#24304b",
  text: "#fff",
  muted: "rgba(255,255,255,0.6)",
  faint: "rgba(255,255,255,0.34)",
  accent: "#d5f575",
  accentSoft: "rgba(213,245,117,0.12)",
  outgoing: "#151910",
  incoming: "#121317",
};

const tabs = [
  ["chat", "Chats"],
  ["rooms", "Rooms"],
  ["secret", "Secret"],
] as const;

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Surface({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <BlurView intensity={18} tint="dark" style={[styles.surface, style]}>
      {children}
    </BlurView>
  );
}

function AppBackground() {
  return (
    <>
      <LinearGradient colors={["#040404", "#090a0d", "#030303"]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(72,108,255,0.10)", "transparent", "rgba(70,70,120,0.06)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

function Avatar({ label, active }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.avatar, active && styles.avatarActive]}>
      <Text style={[styles.avatarText, active && styles.avatarTextActive]}>{label}</Text>
    </View>
  );
}

function LoginScreen() {
  const hydrate = useMobileStore((state) => state.hydrate);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [inviteCode, setInviteCode] = useState("FROST-FRIENDS");
  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);
      const payload = await mobileApi.login(email, passphrase, inviteCode, username);
      hydrate(payload);
    } catch (error) {
      Alert.alert("Unable to join", error instanceof Error ? error.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <AppBackground />
      <View style={styles.centerWrap}>
        <Surface style={styles.loginCard}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
            <View>
              <Text style={styles.kicker}>FrostChat</Text>
              <Text style={styles.heroTitle}>Private inbox</Text>
            </View>
          </View>
          <Text style={styles.heroSub}>The phone app now follows the same black, compact design as the web app.</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.faint} style={styles.input} />
          <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={c.faint} style={styles.input} />
          <TextInput value={passphrase} onChangeText={setPassphrase} secureTextEntry placeholder="Passphrase" placeholderTextColor={c.faint} style={styles.input} />
          <TextInput value={inviteCode} onChangeText={setInviteCode} placeholder="Invite code" placeholderTextColor={c.faint} style={styles.input} />
          <Pressable style={styles.primaryButton} onPress={() => void submit()} disabled={loading}>
            <Text style={styles.primaryButtonLabel}>{loading ? "Joining..." : "Enter FrostChat"}</Text>
          </Pressable>
        </Surface>
      </View>
    </SafeAreaView>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === "image") {
    return <Image source={{ uri: attachment.url }} style={styles.attachmentImage} />;
  }
  return (
    <View style={styles.attachmentCard}>
      <Text style={styles.attachmentBadge}>
        {attachment.kind === "video" ? "Video" : attachment.kind === "voice" ? "Voice note" : "File"}
      </Text>
      <Text style={styles.attachmentName}>{attachment.name}</Text>
    </View>
  );
}

function MessageRow({
  conversation,
  message,
  currentUserId,
}: {
  conversation: Conversation;
  message: ChatMessage;
  currentUserId: string;
}) {
  const users = useMobileStore((state) => state.users);
  const readSecretMessage = useMobileStore((state) => state.readSecretMessage);
  const outgoing = message.senderId === currentUserId;
  const body = conversation.kind === "secret" ? readSecretMessage(conversation.id, message.id) : message.body;
  const sender = users.find((user) => user.id === message.senderId)?.username ?? "Friend";

  return (
    <View style={[styles.messageRow, outgoing ? styles.end : styles.start]}>
      {!outgoing ? <Avatar label={initials(sender)} /> : null}
      <View style={styles.messageCol}>
        {!outgoing && conversation.kind === "group" ? <Text style={styles.messageSender}>{sender}</Text> : null}
        <View style={[styles.messageBubble, outgoing ? styles.outgoingBubble : styles.incomingBubble]}>
          {message.attachments?.map((attachment) => <AttachmentPreview key={attachment.id} attachment={attachment} />)}
          {body ? <Text style={styles.messageText}>{body}</Text> : null}
          <View style={styles.messageMeta}>
            <Text style={styles.messageMetaText}>
              {new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt))}
            </Text>
            {outgoing ? <Text style={styles.messageStatus}>{message.status}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function ChatScreen() {
  const session = useMobileStore((state) => state.session);
  const users = useMobileStore((state) => state.users);
  const allConversations = useMobileStore((state) => state.conversations);
  const activeConversationId = useMobileStore((state) => state.activeConversationId);
  const messagesByConversation = useMobileStore((state) => state.messagesByConversation);
  const setActiveConversation = useMobileStore((state) => state.setActiveConversation);
  const addMessage = useMobileStore((state) => state.addMessage);
  const updateMessageStatus = useMobileStore((state) => state.updateMessageStatus);
  const onlineUserIds = useMobileStore((state) => state.onlineUserIds);
  const conversations = useMemo(
    () => allConversations.filter((conversation) => conversation.kind !== "secret"),
    [allConversations],
  );
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (activeConversation) {
      joinConversation(activeConversation.id);
    }
  }, [activeConversation]);

  useEffect(() => {
    if (!activeConversation || !session) {
      return;
    }
    (messagesByConversation[activeConversation.id] ?? [])
      .filter((message) => message.senderId !== session.user.id && message.status !== "seen")
      .forEach((message) => {
        emitStatus({
          conversationId: activeConversation.id,
          messageId: message.id,
          status: "seen",
          userId: session.user.id,
          targetUserIds: activeConversation.participantIds.filter((id) => id !== session.user.id),
        });
        updateMessageStatus({ conversationId: activeConversation.id, messageId: message.id, status: "seen", userId: session.user.id });
      });
  }, [activeConversation, messagesByConversation, session, updateMessageStatus]);

  async function createAttachment(kind: "image" | "document"): Promise<Attachment | undefined> {
    setUploading(true);
    try {
      if (kind === "image") {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.7 });
        if (result.canceled) return undefined;
        const asset = result.assets[0];
        return await uploadAttachment({
          uri: asset.uri,
          fileName: asset.fileName || `media-${Date.now()}`,
          mimeType: asset.mimeType ?? undefined,
          bytes: asset.fileSize,
          kind: asset.type === "video" ? "video" : "image",
        });
      }

      const result = await DocumentPicker.getDocumentAsync({});
      if (result.canceled) return undefined;
      const asset = result.assets[0];
      return await uploadAttachment({
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType ?? undefined,
        bytes: asset.size,
        kind: "document",
      });
    } finally {
      setUploading(false);
    }
  }

  async function toggleVoice() {
    if (recording) {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri || !activeConversation || !session) return;
      try {
        setUploading(true);
        const attachment = await uploadAttachment({
          uri,
          fileName: `voice-${Date.now()}.m4a`,
          mimeType: "audio/mp4",
          kind: "voice",
        });
        const message = useMobileStore.getState().createOutgoingMessage({ conversation: activeConversation, body: "" });
        message.type = "voice";
        message.attachments = [attachment];
        addMessage(message);
        emitMessage({ message, targetUserIds: activeConversation.participantIds.filter((id) => id !== session.user.id) });
      } catch (error) {
        Alert.alert("Upload failed", error instanceof Error ? error.message : "Try recording again.");
      } finally {
        setUploading(false);
      }
      return;
    }
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const nextRecording = new Audio.Recording();
    await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await nextRecording.startAsync();
    setRecording(nextRecording);
  }

  async function sendMessage(attachment?: Attachment) {
    if (!activeConversation || !session || (!draft.trim() && !attachment)) return;
    const message = useMobileStore.getState().createOutgoingMessage({ conversation: activeConversation, body: draft.trim() });
    if (attachment) {
      message.attachments = [attachment];
      message.type = attachment.kind;
    }
    addMessage(message);
    emitMessage({ message, targetUserIds: activeConversation.participantIds.filter((id) => id !== session.user.id) });
    setDraft("");
  }

  if (!activeConversation || !session) {
    return (
      <Surface style={styles.emptyPanel}>
        <Text style={styles.sectionTitle}>No conversation selected</Text>
        <Text style={styles.panelMeta}>Create another account and start a chat to see it here.</Text>
      </Surface>
    );
  }

  const messages = [...(messagesByConversation[activeConversation.id] ?? [])].reverse();
  const dmOtherId = activeConversation.participantIds.find((id) => id !== session.user.id);
  const isOnline = dmOtherId ? onlineUserIds.includes(dmOtherId) : false;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <Surface style={styles.strip}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Inbox</Text>
          <Text style={styles.smallMeta}>{onlineUserIds.length} online</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
          {conversations.map((conversation) => {
            const title =
              conversation.kind === "dm"
                ? users.find((user) => user.id === conversation.participantIds.find((id) => id !== session.user.id))?.username ?? conversation.title
                : conversation.title;
            return (
              <Pressable
                key={conversation.id}
                style={[styles.chip, conversation.id === activeConversation.id && styles.chipActive]}
                onPress={() => setActiveConversation(conversation.id)}
              >
                <Avatar label={initials(title)} active={conversation.id === activeConversation.id} />
                <View style={styles.min0}>
                  <Text style={styles.chipTitle} numberOfLines={1}>{title}</Text>
                  <Text style={styles.chipMeta} numberOfLines={1}>{conversation.kind === "group" ? "Group" : "Direct message"}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Surface>

      <Surface style={styles.chatPanel}>
        <View style={styles.chatHeader}>
          <View style={styles.headerLeft}>
            <Avatar label={initials(activeConversation.title)} />
            <View>
              <Text style={styles.chatTitle}>{activeConversation.title}</Text>
              <Text style={styles.panelMeta}>
                {activeConversation.kind === "group" ? `${activeConversation.participantIds.length} members` : isOnline ? "Online now" : "Offline"}
              </Text>
            </View>
          </View>
          <View style={styles.dotButton}><Text style={styles.dotText}>...</Text></View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageRow conversation={activeConversation} message={item} currentUserId={session.user.id} />}
          contentContainerStyle={styles.messages}
        />

        <View style={styles.composerWrap}>
          <View style={styles.composerBox}>
            <TextInput
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                emitTyping({ conversationId: activeConversation.id, kind: activeConversation.kind, userId: session.user.id }, true);
              }}
              placeholder="Write a message"
              placeholderTextColor={c.faint}
              style={styles.composerInput}
              multiline
            />
          </View>
          <View style={styles.actions}>
            <Pressable
              style={styles.miniButton}
              disabled={uploading}
              onPress={() =>
                void createAttachment("image")
                  .then((att) => att && sendMessage(att))
                  .catch((error) =>
                    Alert.alert("Upload failed", error instanceof Error ? error.message : "Try again."),
                  )
              }
            >
              <Text style={styles.miniLabel}>{uploading ? "Uploading" : "Media"}</Text>
            </Pressable>
            <Pressable
              style={styles.miniButton}
              disabled={uploading}
              onPress={() =>
                void createAttachment("document")
                  .then((att) => att && sendMessage(att))
                  .catch((error) =>
                    Alert.alert("Upload failed", error instanceof Error ? error.message : "Try again."),
                  )
              }
            >
              <Text style={styles.miniLabel}>{uploading ? "Uploading" : "File"}</Text>
            </Pressable>
            <Pressable style={styles.miniButton} disabled={uploading} onPress={() => void toggleVoice()}><Text style={styles.miniLabel}>{recording ? "Stop" : uploading ? "Uploading" : "Voice"}</Text></Pressable>
            <Pressable style={styles.sendButton} disabled={uploading} onPress={() => void sendMessage()}><Text style={styles.sendLabel}>{uploading ? "Please wait" : "Send"}</Text></Pressable>
          </View>
        </View>
      </Surface>
    </KeyboardAvoidingView>
  );
}

function RoomsScreen() {
  const session = useMobileStore((state) => state.session);
  const rooms = useMobileStore((state) => state.rooms);
  const users = useMobileStore((state) => state.users);
  const upsertRoom = useMobileStore((state) => state.upsertRoom);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Surface style={styles.stackPanel}>
        <Text style={styles.sectionTitle}>Rooms</Text>
        <Text style={styles.panelMeta}>Create a live space and bring your circle in.</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Room name" placeholderTextColor={c.faint} style={styles.input} />
        <TextInput value={topic} onChangeText={setTopic} placeholder="Topic or now playing" placeholderTextColor={c.faint} style={styles.input} />
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            void mobileApi
              .createRoom(session!, { name, topic })
              .then((room) => {
                upsertRoom(room);
                setName("");
                setTopic("");
                Alert.alert("Room created", "The room was added locally.");
              })
              .catch((error) =>
                Alert.alert("Room creation failed", error instanceof Error ? error.message : "Try again."),
              )
          }
        >
          <Text style={styles.primaryButtonLabel}>Start Room</Text>
        </Pressable>
      </Surface>

      {rooms.map((room) => (
        <Surface key={room.id} style={styles.stackPanel}>
          <Text style={styles.chatTitle}>{room.name}</Text>
          <Text style={styles.panelMeta}>{room.topic || "No topic set"}</Text>
          <Text style={styles.smallMeta}>Host {users.find((user) => user.id === room.hostId)?.username ?? room.hostId}</Text>
          <Text style={styles.smallMeta}>Code {room.code}</Text>
        </Surface>
      ))}
    </ScrollView>
  );
}

function SecretScreen() {
  const session = useMobileStore((state) => state.session);
  const users = useMobileStore((state) => state.users);
  const secretPin = useMobileStore((state) => state.secretPin);
  const secretUnlocked = useMobileStore((state) => state.secretUnlocked);
  const setSecretPin = useMobileStore((state) => state.setSecretPin);
  const unlockSecret = useMobileStore((state) => state.unlockSecret);
  const lockSecret = useMobileStore((state) => state.lockSecret);
  const allConversations = useMobileStore((state) => state.conversations);
  const setActiveConversation = useMobileStore((state) => state.setActiveConversation);
  const addMessage = useMobileStore((state) => state.addMessage);
  const conversations = useMemo(
    () => allConversations.filter((conversation) => conversation.kind === "secret"),
    [allConversations],
  );
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [draft, setDraft] = useState("");
  const activeConversation = useMemo(() => conversations.find((conversation) => conversation.id === useMobileStore.getState().activeConversationId) ?? conversations[0], [conversations]);

  async function unlockWithBiometrics() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      Alert.alert("Biometrics unavailable", "Use your vault PIN on this device.");
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock FrostChat secret chats", disableDeviceFallback: false });
    if (result.success && secretPin) unlockSecret(secretPin);
  }

  if (!secretUnlocked) {
    return (
      <Surface style={styles.stackPanel}>
        <Text style={styles.sectionTitle}>Secret Vault</Text>
        <Text style={styles.panelMeta}>{secretPin ? "Enter your PIN or use biometrics." : "Use the default pass 111222 to reveal the hidden layer for the first time."}</Text>
        <TextInput value={pin} onChangeText={setPin} secureTextEntry placeholder="Vault PIN" placeholderTextColor={c.faint} style={styles.input} />
        <Pressable style={styles.primaryButton} onPress={() => { if (!secretPin) { if (pin === "111222") setSecretPin("111222"); else Alert.alert("Incorrect pass", "Use 111222 the first time."); } else if (!unlockSecret(pin)) Alert.alert("Incorrect PIN", "Try again."); setPin(""); }}>
          <Text style={styles.primaryButtonLabel}>{secretPin ? "Unlock Vault" : "Reveal Hidden Layer"}</Text>
        </Pressable>
        {secretPin ? <Pressable style={styles.secondaryButton} onPress={() => void unlockWithBiometrics()}><Text style={styles.secondaryButtonLabel}>Use biometrics</Text></Pressable> : null}
      </Surface>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Surface style={styles.stackPanel}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Hidden Threads</Text>
          <Pressable style={styles.secondaryPill} onPress={lockSecret}><Text style={styles.secondaryPillText}>Lock</Text></Pressable>
        </View>
        <Text style={styles.panelMeta}>Encrypted locally with your shared PIN.</Text>
        <TextInput value={pin} onChangeText={setPin} placeholder="Change local pass" placeholderTextColor={c.faint} style={styles.input} />
        <Pressable style={styles.secondaryButton} onPress={() => { if (!pin.trim()) return; setSecretPin(pin.trim()); setPin(""); }}>
          <Text style={styles.secondaryButtonLabel}>Save vault pass</Text>
        </Pressable>
        <TextInput value={name} onChangeText={setName} placeholder="Secret chat name" placeholderTextColor={c.faint} style={styles.input} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
          {users.filter((user) => user.id !== session?.user.id).map((user) => (
            <Pressable key={user.id} style={[styles.secretChip, selectedUserId === user.id && styles.chipActive]} onPress={() => setSelectedUserId(user.id)}>
              <Avatar label={initials(user.username)} active={selectedUserId === user.id} />
              <Text style={styles.secretChipText}>{user.username}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={styles.primaryButton} onPress={() => {
          if (!session || !name.trim() || !selectedUserId) return;
          const conversation = useMobileStore.getState().createSecretConversation(name.trim(), [session.user.id, selectedUserId]);
          setActiveConversation(conversation.id);
          setName("");
          setSelectedUserId("");
        }}>
          <Text style={styles.primaryButtonLabel}>Create Secret Chat</Text>
        </Pressable>
      </Surface>

      {activeConversation ? (
        <Surface style={styles.stackPanel}>
          <Text style={styles.chatTitle}>{activeConversation.title}</Text>
          <FlatList
            data={[...(useMobileStore.getState().messagesByConversation[activeConversation.id] ?? [])].reverse()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageRow conversation={activeConversation} message={item} currentUserId={session!.user.id} />}
            contentContainerStyle={styles.messages}
            scrollEnabled={false}
          />
          <TextInput value={draft} onChangeText={setDraft} placeholder="Encrypted message" placeholderTextColor={c.faint} style={styles.input} />
          <Pressable style={styles.primaryButton} onPress={() => {
            if (!session || !draft.trim()) return;
            const message = useMobileStore.getState().createOutgoingMessage({ conversation: activeConversation, body: draft.trim(), selfDestructSeconds: 60 });
            addMessage(message);
            emitMessage({ message, targetUserIds: activeConversation.participantIds.filter((id) => id !== session.user.id) });
            setDraft("");
          }}>
            <Text style={styles.primaryButtonLabel}>Send Secret Message</Text>
          </Pressable>
        </Surface>
      ) : null}
    </ScrollView>
  );
}

function FrostMobileApp() {
  const session = useMobileStore((state) => state.session);
  const activeTab = useMobileStore((state) => state.activeTab);
  const hydrate = useMobileStore((state) => state.hydrate);
  const addMessage = useMobileStore((state) => state.addMessage);
  const mergeMessages = useMobileStore((state) => state.mergeMessages);
  const setOnlineUsers = useMobileStore((state) => state.setOnlineUsers);
  const updateMessageStatus = useMobileStore((state) => state.updateMessageStatus);
  const toggleReaction = useMobileStore((state) => state.toggleReaction);
  const deleteMessage = useMobileStore((state) => state.deleteMessage);
  const setActiveTab = useMobileStore((state) => state.setActiveTab);
  const onlineUserCount = useMobileStore((state) => state.onlineUserIds.length);
  const conversationIds = useMobileStore((state) =>
    state.conversations.filter((conversation) => conversation.kind !== "secret").map((conversation) => conversation.id),
  );

  useEffect(() => {
    if (!session) return;
    void mobileApi.me(session.token, session.refreshToken).then(hydrate);
    connectMobileSocket(session, {
      onConnect: () => undefined,
      onDisconnect: () => undefined,
      onPresence: setOnlineUsers,
      onMessage: addMessage,
      onMessageStatus: updateMessageStatus,
      onReaction: toggleReaction,
      onDelete: deleteMessage,
      onTyping: () => undefined,
      onCache: (messages) => { if (messages[0]) mergeMessages(messages[0].conversationId, messages); },
    }, { conversationIds });
  }, [addMessage, conversationIds, deleteMessage, hydrate, mergeMessages, session, setOnlineUsers, toggleReaction, updateMessageStatus]);

  if (!session) return <LoginScreen />;

  return (
    <SafeAreaView style={styles.screen}>
      <AppBackground />
      <View style={styles.appShell}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.kicker}>FrostChat</Text>
            <Text style={styles.heroTitle}>Messages</Text>
          </View>
          <View style={styles.onlinePill}><Text style={styles.onlinePillText}>{onlineUserCount} online</Text></View>
        </View>

        <View style={styles.tabs}>
          {tabs.map(([tab, label]) => (
            <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "chat" ? <ChatScreen /> : null}
        {activeTab === "rooms" ? <RoomsScreen /> : null}
        {activeTab === "secret" ? <SecretScreen /> : null}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <FrostMobileApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 18 },
  appShell: { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12 },
  surface: { borderRadius: 28, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, overflow: "hidden" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  brandMark: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.accent },
  brandMarkText: { color: "#050505", fontSize: 18, fontWeight: "800" },
  kicker: { color: c.muted, fontSize: 11, letterSpacing: 2.8, textTransform: "uppercase" },
  heroTitle: { color: c.text, fontSize: 30, fontWeight: "700", marginTop: 6 },
  heroSub: { color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 16, marginBottom: 4 },
  loginCard: { padding: 22 },
  input: { marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, color: c.text, paddingHorizontal: 16, paddingVertical: 14 },
  primaryButton: { marginTop: 16, borderRadius: 20, backgroundColor: c.accent, paddingVertical: 14, alignItems: "center" },
  primaryButtonLabel: { color: "#050505", fontSize: 15, fontWeight: "700" },
  secondaryButton: { marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  secondaryButtonLabel: { color: c.muted, fontWeight: "600" },
  onlinePill: { borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, paddingHorizontal: 12, paddingVertical: 8 },
  onlinePillText: { color: c.muted, fontSize: 12, fontWeight: "600" },
  tabs: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 12 },
  tab: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, alignItems: "center", paddingVertical: 12 },
  tabActive: { backgroundColor: c.accentSoft, borderColor: c.borderStrong },
  tabText: { color: c.muted, fontWeight: "700" },
  tabTextActive: { color: c.text },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: c.text, fontSize: 20, fontWeight: "700" },
  panelMeta: { color: c.muted, marginTop: 6, lineHeight: 21 },
  smallMeta: { color: c.faint, marginTop: 6, fontSize: 12 },
  strip: { padding: 14, marginBottom: 12 },
  rowGap: { gap: 10, paddingTop: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 180, borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, paddingHorizontal: 12, paddingVertical: 12 },
  chipActive: { borderColor: c.borderStrong, backgroundColor: c.panelSoft },
  min0: { minWidth: 0, flex: 1 },
  chipTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
  chipMeta: { color: c.faint, fontSize: 12, marginTop: 3 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#17191d", borderWidth: 1, borderColor: c.border },
  avatarActive: { borderColor: c.borderStrong, backgroundColor: c.accentSoft },
  avatarText: { color: c.text, fontWeight: "700", fontSize: 13 },
  avatarTextActive: { color: "#eff8bb" },
  chatPanel: { flex: 1, paddingTop: 18 },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  chatTitle: { color: c.text, fontSize: 18, fontWeight: "700" },
  dotButton: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong },
  dotText: { color: c.muted, fontSize: 18, fontWeight: "700" },
  messages: { gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  messageRow: { flexDirection: "row", gap: 10 },
  start: { justifyContent: "flex-start" },
  end: { justifyContent: "flex-end" },
  messageCol: { maxWidth: "82%" },
  messageSender: { color: c.faint, fontSize: 11, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6, marginLeft: 2 },
  messageBubble: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  incomingBubble: { borderColor: c.border, backgroundColor: c.incoming },
  outgoingBubble: { borderColor: c.borderStrong, backgroundColor: c.outgoing },
  messageText: { color: c.text, fontSize: 14, lineHeight: 22 },
  messageMeta: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 10 },
  messageMetaText: { color: c.faint, fontSize: 11 },
  messageStatus: { color: "#dce9a6", fontSize: 11, fontWeight: "600" },
  attachmentImage: { width: 210, height: 210, borderRadius: 18, marginBottom: 10, backgroundColor: c.panelStrong },
  attachmentCard: { borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10 },
  attachmentBadge: { color: c.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.4 },
  attachmentName: { color: c.text, fontSize: 13, fontWeight: "600", marginTop: 8 },
  composerWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: c.border },
  composerBox: { borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, paddingHorizontal: 14, paddingVertical: 10 },
  composerInput: { color: c.text, minHeight: 42, maxHeight: 120, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  miniButton: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, paddingHorizontal: 12, paddingVertical: 11 },
  miniLabel: { color: c.muted, fontSize: 12, fontWeight: "700" },
  sendButton: { flex: 1, borderRadius: 16, backgroundColor: c.accent, paddingVertical: 12, alignItems: "center" },
  sendLabel: { color: "#050505", fontWeight: "800" },
  scrollContent: { paddingBottom: 36 },
  stackPanel: { padding: 16, marginBottom: 12 },
  secondaryPill: { borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryPillText: { color: c.muted, fontWeight: "700", fontSize: 12 },
  secretChip: { alignItems: "center", gap: 8, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.panelStrong, paddingHorizontal: 12, paddingVertical: 12, minWidth: 92 },
  secretChipText: { color: c.text, fontSize: 12, fontWeight: "700" },
  emptyPanel: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
});
