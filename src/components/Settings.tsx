import { useState } from "react";
import { Check, Copy, Trash2, RefreshCw } from "lucide-react";
import { Modal } from "./Modal";
import {
  setPreferences,
  themes,
  usePreferences,
} from "../services/preferences";
import { getRecipeStore, useRecipes } from "../services/recipeSync";
import { ORACLE_APP_ORIGIN, oracleSupabaseUrl } from "../services/oracleConfig";
import { buildWidgetScript } from "../services/widgetScript";
export function Settings({ onClose }: { onClose: () => void }) {
  const preferences = usePreferences();
  const widgetUrl = oracleSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
  const widgetApiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const data = useRecipes(),
    [resetStage, setResetStage] = useState(0),
    [resetBusy, setResetBusy] = useState(false),
    [resetError, setResetError] = useState(""),
    [notice, setNotice] = useState("");
  function updatePreferences(value: Parameters<typeof setPreferences>[0]) {
    try {
      setPreferences(value);
    } catch {
      setNotice(
        "Vos préférences n’ont pas pu être sauvegardées sur cet appareil.",
      );
    }
  }
  async function copyWidget() {
    try {
      await navigator.clipboard.writeText(
        buildWidgetScript(
          ORACLE_APP_ORIGIN,
          widgetUrl || "",
          widgetApiKey || "",
        ),
      );
      setNotice(
        "Script copié. Collez-le dans un nouveau script Scriptable, puis ajoutez le widget à votre écran d’accueil.",
      );
    } catch {
      setNotice(
        "La copie est indisponible dans ce navigateur. Réessayez dans Safari.",
      );
    }
  }
  if (resetStage)
    return (
      <Modal
        title={
          resetStage === 1 ? "Repartir de zéro ?" : "Dernière confirmation"
        }
        onClose={() => { if (!resetBusy) setResetStage(0); }}
      >
        <p className="confirmation-copy">
          {resetStage === 1
            ? data.status === "local"
              ? "Toutes les recettes enregistrées sur cet appareil seront effacées."
              : "Toutes les recettes et photos du livre global seront effacées pour tous les visiteurs."
            : "Cette suppression est définitive."}
        </p>
        {resetError && <p className="notice" role="alert">{resetError}</p>}
        <div className="confirmation-actions">
          <button className="secondary-button" disabled={resetBusy} onClick={() => setResetStage(0)}>
            Annuler
          </button>
          <button
            className="danger-button"
            disabled={resetBusy}
            onClick={async () => {
              if (resetStage === 1) {
                setResetStage(2);
                return;
              }
              setResetBusy(true);
              setResetError("");
              try {
                await getRecipeStore().reset();
                setResetStage(0);
                setNotice("Le livre est vide.");
              } catch (error) {
                setResetError((error as Error).message);
              } finally {
                setResetBusy(false);
              }
            }}
          >
            {resetStage === 1 ? "Continuer" : "Oui, effacer toutes les recettes"}
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal title="À votre goût." onClose={onClose} className="settings">
      <p className="modal-subtitle">Un carnet qui vous ressemble.</p>
      <h3 className="eyebrow">Votre expérience</h3>
      <div
        className="layout-options"
        role="group"
        aria-label="Mode d’expérience"
      >
        <button
          className="layout-option"
          aria-label="Paquet de cartes"
          aria-pressed={preferences.layoutMode === "cards"}
          onClick={() => updatePreferences({ layoutMode: "cards" })}
        >
          <span aria-hidden="true">🃏</span>
          <strong>Paquet de cartes</strong>
          <small>Piochez l’inspiration.</small>
        </button>
        <button
          className="layout-option"
          aria-label="Livre de recettes"
          aria-pressed={preferences.layoutMode === "book"}
          onClick={() => updatePreferences({ layoutMode: "book" })}
        >
          <span aria-hidden="true">📖</span>
          <strong>Livre de recettes</strong>
          <small>Tournez les pages.</small>
        </button>
      </div>
      <h3 className="eyebrow">Votre palette</h3>
      <div className="theme-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            className={`theme-option ${preferences.theme === theme.id ? "selected" : ""}`}
            aria-pressed={preferences.theme === theme.id}
            onClick={() => updatePreferences({ theme: theme.id })}
          >
            <span className="theme-swatches" style={{ background: theme.bg }}>
              <i style={{ background: theme.primary }} />
              <i style={{ background: theme.secondary }} />
              {preferences.theme === theme.id && <Check size={14} />}
            </span>
            <span>{theme.name}</span>
          </button>
        ))}
      </div>
      <div className="connection-status" role="status">
        <span
          className={`status-dot ${data.status === "offline" ? "offline" : ""}`}
        />
        {data.status === "local"
          ? "Sauvegarde sur cet appareil"
          : data.status === "syncing"
            ? "Synchronisation…"
            : data.status === "offline"
              ? "Hors ligne · dernière copie du livre"
              : data.realtime
                ? "Supabase · temps réel connecté"
                : "Supabase · livre global synchronisé"}
        <button
          className="small-icon"
          aria-label="Synchroniser maintenant"
          onClick={() => void getRecipeStore().sync()}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {data.lastSync && (
        <p className="fine-print">
          Dernière synchronisation{" "}
          <time dateTime={data.lastSync}>
            {new Date(data.lastSync).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
          </time>
        </p>
      )}
      <details className="sync-details widget-help">
        <summary>Une recette sur l’écran d’accueil</summary>
        <p className="fine-print">
          Dans Scriptable, créez un script et collez le texte copié. Ajoutez
          ensuite le widget Scriptable à votre écran d’accueil et choisissez ce
          script.
        </p>
        <button
          className="secondary-button full-width"
          disabled={!widgetUrl || !widgetApiKey}
          onClick={() => void copyWidget()}
        >
          <Copy size={14} /> Copier le script Scriptable
        </button>
      </details>
      <button className="reset-button" onClick={() => { setResetError(""); setResetStage(1); }}>
        <Trash2 size={15} /> Reset Total · repartir de zéro
      </button>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <p className="fine-print">Fait pour les petites et les grandes faims.</p>
    </Modal>
  );
}
