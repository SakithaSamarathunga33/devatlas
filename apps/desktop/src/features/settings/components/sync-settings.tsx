import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { HStack } from "@astryxdesign/core/HStack";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { errorMessage } from "@/features/community";
import {
  startLibrarySyncOver,
  turnOffLibrarySync,
  turnOnLibrarySync,
} from "@/services/library-sync.service";
import type { SyncReport } from "@/types/library-sync.types";

import {
  refreshAfterSync,
  syncRunQueryKey,
  syncStatusQueryKey,
  useLibrarySyncRun,
  useLibrarySyncStatus,
} from "../hooks/use-library-sync";
import { SettingsSection } from "./settings-section";

/** Mirrors `MIN_PASSPHRASE_CHARS` in the Rust application layer. */
const MIN_PASSPHRASE_CHARS = 10;

const syncedTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

type DialogMode = "create" | "enter" | "startOver";

/** Library sync between the user's computers: its state here, and turning it on or off. */
export function SyncSettings() {
  const status = useLibrarySyncStatus();
  const [dialog, setDialog] = useState<DialogMode | null>(null);

  return (
    <SettingsSection
      title="Sync"
      description="Keep your saved links, notes, tags, collections and snippets the same on every computer you sign in on. They're encrypted with your sync passphrase before they leave this computer, so nobody else can read them, not even the Community server. Browser bookmarks sync through your browser."
    >
      {status.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Checking sync</span>
          <Skeleton height={72} />
        </div>
      ) : status.isError ? (
        <Banner
          role="alert"
          status="error"
          title="Couldn't check sync"
          description={errorMessage(status.error)}
        />
      ) : status.data.state === "signedOut" ? (
        <Text as="p" color="secondary">
          Sign in with GitHub under Account to sync your library between your computers.
        </Text>
      ) : status.data.state === "off" ? (
        <VStack gap={3}>
          <Text as="p" color="secondary">
            Sync is off. Turn it on here first, then enter the same passphrase on your other
            computers.
          </Text>
          <HStack hAlign="end">
            <Button
              variant="primary"
              label="Turn on sync"
              onClick={() => {
                setDialog("create");
              }}
            />
          </HStack>
        </VStack>
      ) : status.data.state === "needsPassphrase" ? (
        <VStack gap={3}>
          <Text as="p" color="secondary">
            Your library is synced from another computer. Enter your sync passphrase to sync it here
            too; what's already on this computer is kept.
          </Text>
          <HStack hAlign="end">
            <Button
              variant="primary"
              label="Enter passphrase"
              onClick={() => {
                setDialog("enter");
              }}
            />
          </HStack>
        </VStack>
      ) : (
        <SyncOn syncedAt={status.data.syncedAt} />
      )}
      {dialog !== null && (
        <PassphraseDialog
          mode={dialog}
          onModeChange={setDialog}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </SettingsSection>
  );
}

function SyncOn({ syncedAt }: { syncedAt: number | null }) {
  const queryClient = useQueryClient();
  // Watches the app-wide runner's syncs; "Sync now" runs one more.
  const run = useLibrarySyncRun(false);
  const turnOff = useMutation({
    mutationFn: turnOffLibrarySync,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: syncRunQueryKey });
      await queryClient.invalidateQueries({ queryKey: syncStatusQueryKey });
      toast.success("Sync is off on this computer");
    },
  });

  return (
    <VStack gap={3}>
      <Text as="p">
        {syncedAt === null
          ? "Sync is on."
          : `Sync is on. Last synced ${syncedTime.format(new Date(syncedAt))}.`}
      </Text>
      {run.isError && !run.isFetching && (
        <Banner
          role="alert"
          status="warning"
          title="The last sync didn't finish"
          description={`${errorMessage(run.error)} DevAtlas tries again in a few minutes.`}
        />
      )}
      {turnOff.isError && (
        <Banner
          role="alert"
          status="error"
          title="Couldn't turn sync off"
          description={errorMessage(turnOff.error)}
        />
      )}
      <HStack gap={2} hAlign="end">
        <Button
          variant="ghost"
          label="Turn off on this computer"
          isDisabled={run.isFetching}
          isLoading={turnOff.isPending}
          onClick={() => {
            turnOff.mutate();
          }}
        />
        <Button
          label="Sync now"
          isLoading={run.isFetching}
          onClick={() => {
            void run.refetch({ cancelRefetch: false });
          }}
        />
      </HStack>
    </VStack>
  );
}

const DIALOG_TEXT: Record<DialogMode, { title: string; submit: string }> = {
  create: { title: "Turn on sync", submit: "Turn on sync" },
  enter: { title: "Enter your sync passphrase", submit: "Start syncing" },
  startOver: { title: "Start sync over", submit: "Delete synced copy and start over" },
};

/** Asks for the sync passphrase: a new one (twice), or the one set on another computer. */
function PassphraseDialog({
  mode,
  onModeChange,
  onClose,
}: {
  mode: DialogMode;
  onModeChange: (mode: DialogMode) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [passphrase, setPassphrase] = useState("");
  const [repeated, setRepeated] = useState("");
  const [isChecked, setIsChecked] = useState(false);
  const isNew = mode !== "enter";
  // Code points, as Rust counts them.
  const tooShort = Array.from(passphrase).length < MIN_PASSPHRASE_CHARS;
  const mismatch = isNew && repeated !== passphrase;

  const save = useMutation({
    mutationFn: () =>
      mode === "startOver" ? startLibrarySyncOver(passphrase) : turnOnLibrarySync(passphrase),
    onSuccess: (report: SyncReport) => {
      // With sync on, the app-wide runner takes over from here.
      void queryClient.invalidateQueries({ queryKey: syncStatusQueryKey });
      if (report.changed) refreshAfterSync(queryClient);
      toast.success(mode === "enter" ? "Your library is synced" : "Sync is on");
      onClose();
    },
  });

  return (
    <Modal title={DIALOG_TEXT[mode].title} onClose={onClose} purpose="form">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setIsChecked(true);
          if (tooShort || mismatch) return;
          save.mutate();
        }}
      >
        <VStack gap={4}>
          {mode === "create" && (
            <Banner
              status="warning"
              title="Keep your passphrase somewhere safe"
              description="It's needed on each computer you add. If you forget it, nobody can open the synced copy, but your library on each computer stays as it is."
            />
          )}
          {mode === "startOver" && (
            <Banner
              role="alert"
              status="warning"
              title="This deletes the synced copy"
              description="This computer's library becomes the new synced copy. Your other computers stop syncing until you enter the new passphrase on them; their libraries stay as they are."
            />
          )}
          <FormLayout>
            <TextInput
              // A new input, focused, when the dialog switches to starting over.
              key={mode}
              hasAutoFocus
              type="password"
              label={isNew ? "New sync passphrase" : "Sync passphrase"}
              description={
                isNew ? `At least ${String(MIN_PASSPHRASE_CHARS)} characters.` : undefined
              }
              autoComplete={isNew ? "new-password" : "current-password"}
              hasSpellCheck={false}
              value={passphrase}
              onChange={setPassphrase}
              status={
                isChecked && tooShort
                  ? {
                      type: "error",
                      message: `Use at least ${String(MIN_PASSPHRASE_CHARS)} characters.`,
                    }
                  : undefined
              }
            />
            {isNew && (
              <TextInput
                type="password"
                label="Repeat the passphrase"
                autoComplete="new-password"
                hasSpellCheck={false}
                value={repeated}
                onChange={setRepeated}
                status={
                  isChecked && !tooShort && mismatch
                    ? { type: "error", message: "The passphrases don't match." }
                    : undefined
                }
              />
            )}
          </FormLayout>
          {save.isError && (
            <Banner
              role="alert"
              status="error"
              title="Couldn't turn on sync"
              description={errorMessage(save.error)}
            />
          )}
          <HStack gap={2} hAlign="end" vAlign="center">
            {mode === "enter" && (
              <div className="me-auto">
                <Button
                  variant="ghost"
                  label="Forgot it? Start over"
                  onClick={() => {
                    save.reset();
                    setIsChecked(false);
                    // The passphrase that didn't work mustn't become the new one.
                    setPassphrase("");
                    setRepeated("");
                    onModeChange("startOver");
                  }}
                />
              </div>
            )}
            <Button variant="ghost" label="Cancel" onClick={onClose} />
            <Button
              type="submit"
              variant={mode === "startOver" ? "destructive" : "primary"}
              label={DIALOG_TEXT[mode].submit}
              isLoading={save.isPending}
            />
          </HStack>
        </VStack>
      </form>
    </Modal>
  );
}
