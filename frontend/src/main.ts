import './style.css';
import * as THREE from 'three';
import soundtrackUrl from '../assets/Clarity (BUNT. Remix).mp3';
import soundtrackAltUrl from '../assets/20 Min- Lil Uzi Vert (Slowed  Reverb) [Instrumental] Prod By Apollo.mp3';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5048';

type RegionOption = {
  key: string;
  displayName: string;
};

type RegionOptionApi = {
  key?: string;
  displayName?: string;
  Key?: string;
  DisplayName?: string;
};

type RecapResponse = {
  player: {
    riotId: string;
    tagline: string;
    puuid: string;
    region: string;
  };
  range: {
    startUtc: string;
    endUtc: string;
    days: number;
  };
  summary: {
    totalGames: number;
    wins: number;
    top4s: number;
    totalPlayerDamage: number;
    averagePlacement: number;
  };
  favorites: {
    traits: FavoriteStat[];
    units: FavoriteStat[];
    items: FavoriteStat[];
  };
  matches: PlayedMatch[];
  groups: {
    performanceOverview: {
      totalGames: number;
      wins: number;
      top4s: number;
      averagePlacement: number;
      totalDamage: number;
      bestPlacement: number;
      worstPlacement: number;
    };
    champions: GroupChampion[];
    synergies: GroupSynergy[];
    placementDistribution: GroupPlacementDistribution[];
    items: GroupItem[];
    topComps: GroupTopComp[];
  };
  meta: {
    processedMatchCount: number;
    requestedMatchCount: number;
    rateLimitReached: boolean;
    availableRangeStartUtc?: string | null;
    availableRangeEndUtc?: string | null;
    warnings: string[];
  };
};

type FavoriteStat = {
  id: string;
  name: string;
  iconUrl?: string | null;
  count: number;
};

type MatchTrait = {
  id: string;
  name: string;
  iconUrl?: string | null;
  numUnits: number;
  tierCurrent: number;
  style: number;
};

type MatchItem = {
  id: string;
  name: string;
  iconUrl?: string | null;
  count: number;
};

type MatchUnit = {
  id: string;
  name: string;
  iconUrl?: string | null;
  items: MatchItem[];
};

type PlayedMatch = {
  matchId: string;
  playedAtUtc: string;
  placement: number;
  totalDamageToPlayers: number;
  traits: MatchTrait[];
  units: MatchUnit[];
  items: MatchItem[];
};

type GroupChampion = {
  id: string;
  name: string;
  iconUrl?: string | null;
  games: number;
  averagePlacement: number;
  top4s: number;
};

type GroupSynergy = {
  id: string;
  name: string;
  iconUrl?: string | null;
  appearances: number;
  averagePlacement: number;
  wins: number;
};

type GroupPlacementDistribution = {
  placement: number;
  games: number;
};

type GroupItem = {
  id: string;
  name: string;
  iconUrl?: string | null;
  builds: number;
  averagePlacement: number;
};

type GroupTopComp = {
  key: string;
  title: string;
  units: string[];
  traits: string[];
  games: number;
  averagePlacement: number;
};

type RecapGroupKey = 'performanceOverview' | 'champions' | 'synergies' | 'placementDistribution' | 'items' | 'topComps';

const groupLabels: Record<RecapGroupKey, string> = {
  performanceOverview: 'Performance Overview',
  champions: 'Champions',
  synergies: 'Synergies',
  placementDistribution: 'Placement Distribution',
  items: 'Items',
  topComps: 'Top Comps'
};

type SpawnedCapsuleState = {
  element: HTMLElement;
  moved: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

const spawnedCapsules = new Map<RecapGroupKey, SpawnedCapsuleState>();
let nextCapsuleZIndex = 3;
let currentRecap: RecapResponse | null = null;

function readField<T>(value: Record<string, unknown> | null | undefined, camelKey: string, pascalKey: string) {
  if (!value) {
    return undefined as T | undefined;
  }

  return (value[camelKey] ?? value[pascalKey]) as T | undefined;
}

function normalizeRecapResponse(payload: unknown): RecapResponse {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const player = (readField<Record<string, unknown>>(raw, 'player', 'Player') ?? {});
  const range = (readField<Record<string, unknown>>(raw, 'range', 'Range') ?? {});
  const summary = (readField<Record<string, unknown>>(raw, 'summary', 'Summary') ?? {});
  const favorites = (readField<Record<string, unknown>>(raw, 'favorites', 'Favorites') ?? {});
  const meta = (readField<Record<string, unknown>>(raw, 'meta', 'Meta') ?? {});
  const groups = readField<Record<string, unknown>>(raw, 'groups', 'Groups');

  const recap: RecapResponse = {
    player: {
      riotId: readField<string>(player, 'riotId', 'RiotId') ?? '',
      tagline: readField<string>(player, 'tagline', 'Tagline') ?? '',
      puuid: readField<string>(player, 'puuid', 'Puuid') ?? '',
      region: readField<string>(player, 'region', 'Region') ?? ''
    },
    range: {
      startUtc: readField<string>(range, 'startUtc', 'StartUtc') ?? '',
      endUtc: readField<string>(range, 'endUtc', 'EndUtc') ?? '',
      days: Number(readField<number>(range, 'days', 'Days') ?? 0)
    },
    summary: {
      totalGames: Number(readField<number>(summary, 'totalGames', 'TotalGames') ?? 0),
      wins: Number(readField<number>(summary, 'wins', 'Wins') ?? 0),
      top4s: Number(readField<number>(summary, 'top4s', 'Top4s') ?? 0),
      totalPlayerDamage: Number(readField<number>(summary, 'totalPlayerDamage', 'TotalPlayerDamage') ?? 0),
      averagePlacement: Number(readField<number>(summary, 'averagePlacement', 'AveragePlacement') ?? 0)
    },
    favorites: {
      traits: normalizeFavoriteStats(readField<unknown[]>(favorites, 'traits', 'Traits')),
      units: normalizeFavoriteStats(readField<unknown[]>(favorites, 'units', 'Units')),
      items: normalizeFavoriteStats(readField<unknown[]>(favorites, 'items', 'Items'))
    },
    matches: normalizeMatches(readField<unknown[]>(raw, 'matches', 'Matches')),
    groups: {
      performanceOverview: {
        totalGames: 0,
        wins: 0,
        top4s: 0,
        averagePlacement: 0,
        totalDamage: 0,
        bestPlacement: 0,
        worstPlacement: 0
      },
      champions: [],
      synergies: [],
      placementDistribution: [],
      items: [],
      topComps: []
    },
    meta: {
      processedMatchCount: Number(readField<number>(meta, 'processedMatchCount', 'ProcessedMatchCount') ?? 0),
      requestedMatchCount: Number(readField<number>(meta, 'requestedMatchCount', 'RequestedMatchCount') ?? 0),
      rateLimitReached: Boolean(readField<boolean>(meta, 'rateLimitReached', 'RateLimitReached') ?? false),
      availableRangeStartUtc: readField<string | null>(meta, 'availableRangeStartUtc', 'AvailableRangeStartUtc') ?? null,
      availableRangeEndUtc: readField<string | null>(meta, 'availableRangeEndUtc', 'AvailableRangeEndUtc') ?? null,
      warnings: normalizeStringArray(readField<unknown[]>(meta, 'warnings', 'Warnings'))
    }
  };

  recap.groups = groups ? normalizeGroups(groups) : buildGroupsFromMatches(recap);
  return recap;
}

function normalizeFavoriteStats(entries: unknown[] | undefined): FavoriteStat[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      id: readField<string>(raw, 'id', 'Id') ?? '',
      name: readField<string>(raw, 'name', 'Name') ?? 'Unknown',
      iconUrl: readField<string | null>(raw, 'iconUrl', 'IconUrl') ?? null,
      count: Number(readField<number>(raw, 'count', 'Count') ?? 0)
    };
  });
}

function normalizeMatches(entries: unknown[] | undefined): PlayedMatch[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      matchId: readField<string>(raw, 'matchId', 'MatchId') ?? '',
      playedAtUtc: readField<string>(raw, 'playedAtUtc', 'PlayedAtUtc') ?? '',
      placement: Number(readField<number>(raw, 'placement', 'Placement') ?? 0),
      totalDamageToPlayers: Number(readField<number>(raw, 'totalDamageToPlayers', 'TotalDamageToPlayers') ?? 0),
      traits: normalizeTraits(readField<unknown[]>(raw, 'traits', 'Traits')),
      units: normalizeUnits(readField<unknown[]>(raw, 'units', 'Units')),
      items: normalizeMatchItems(readField<unknown[]>(raw, 'items', 'Items'))
    };
  });
}

function normalizeTraits(entries: unknown[] | undefined): MatchTrait[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      id: readField<string>(raw, 'id', 'Id') ?? '',
      name: readField<string>(raw, 'name', 'Name') ?? 'Unknown trait',
      iconUrl: readField<string | null>(raw, 'iconUrl', 'IconUrl') ?? null,
      numUnits: Number(readField<number>(raw, 'numUnits', 'NumUnits') ?? 0),
      tierCurrent: Number(readField<number>(raw, 'tierCurrent', 'TierCurrent') ?? 0),
      style: Number(readField<number>(raw, 'style', 'Style') ?? 0)
    };
  });
}

function normalizeUnits(entries: unknown[] | undefined): MatchUnit[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      id: readField<string>(raw, 'id', 'Id') ?? '',
      name: readField<string>(raw, 'name', 'Name') ?? 'Unknown unit',
      iconUrl: readField<string | null>(raw, 'iconUrl', 'IconUrl') ?? null,
      items: normalizeMatchItems(readField<unknown[]>(raw, 'items', 'Items'))
    };
  });
}

function normalizeMatchItems(entries: unknown[] | undefined): MatchItem[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      id: readField<string>(raw, 'id', 'Id') ?? '',
      name: readField<string>(raw, 'name', 'Name') ?? 'Unknown item',
      iconUrl: readField<string | null>(raw, 'iconUrl', 'IconUrl') ?? null,
      count: Number(readField<number>(raw, 'count', 'Count') ?? 0)
    };
  });
}

function normalizeGroups(groups: Record<string, unknown>): RecapResponse['groups'] {
  const performanceOverview = (readField<Record<string, unknown>>(groups, 'performanceOverview', 'PerformanceOverview') ?? {});

  return {
    performanceOverview: {
      totalGames: Number(readField<number>(performanceOverview, 'totalGames', 'TotalGames') ?? 0),
      wins: Number(readField<number>(performanceOverview, 'wins', 'Wins') ?? 0),
      top4s: Number(readField<number>(performanceOverview, 'top4s', 'Top4s') ?? 0),
      averagePlacement: Number(readField<number>(performanceOverview, 'averagePlacement', 'AveragePlacement') ?? 0),
      totalDamage: Number(readField<number>(performanceOverview, 'totalDamage', 'TotalDamage') ?? 0),
      bestPlacement: Number(readField<number>(performanceOverview, 'bestPlacement', 'BestPlacement') ?? 0),
      worstPlacement: Number(readField<number>(performanceOverview, 'worstPlacement', 'WorstPlacement') ?? 0)
    },
    champions: normalizeChampionGroups(readField<unknown[]>(groups, 'champions', 'Champions')),
    synergies: normalizeSynergyGroups(readField<unknown[]>(groups, 'synergies', 'Synergies')),
    placementDistribution: normalizePlacementDistribution(readField<unknown[]>(groups, 'placementDistribution', 'PlacementDistribution')),
    items: normalizeItemGroups(readField<unknown[]>(groups, 'items', 'Items')),
    topComps: normalizeTopCompGroups(readField<unknown[]>(groups, 'topComps', 'TopComps'))
  };
}

function normalizeChampionGroups(entries: unknown[] | undefined): GroupChampion[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      id: readField<string>(raw, 'id', 'Id') ?? '',
      name: readField<string>(raw, 'name', 'Name') ?? 'Unknown unit',
      iconUrl: readField<string | null>(raw, 'iconUrl', 'IconUrl') ?? null,
      games: Number(readField<number>(raw, 'games', 'Games') ?? 0),
      averagePlacement: Number(readField<number>(raw, 'averagePlacement', 'AveragePlacement') ?? 0),
      top4s: Number(readField<number>(raw, 'top4s', 'Top4s') ?? 0)
    };
  });
}

function normalizeSynergyGroups(entries: unknown[] | undefined): GroupSynergy[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      id: readField<string>(raw, 'id', 'Id') ?? '',
      name: readField<string>(raw, 'name', 'Name') ?? 'Unknown trait',
      iconUrl: readField<string | null>(raw, 'iconUrl', 'IconUrl') ?? null,
      appearances: Number(readField<number>(raw, 'appearances', 'Appearances') ?? 0),
      averagePlacement: Number(readField<number>(raw, 'averagePlacement', 'AveragePlacement') ?? 0),
      wins: Number(readField<number>(raw, 'wins', 'Wins') ?? 0)
    };
  });
}

function normalizePlacementDistribution(entries: unknown[] | undefined): GroupPlacementDistribution[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      placement: Number(readField<number>(raw, 'placement', 'Placement') ?? 0),
      games: Number(readField<number>(raw, 'games', 'Games') ?? 0)
    };
  });
}

function normalizeItemGroups(entries: unknown[] | undefined): GroupItem[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      id: readField<string>(raw, 'id', 'Id') ?? '',
      name: readField<string>(raw, 'name', 'Name') ?? 'Unknown item',
      iconUrl: readField<string | null>(raw, 'iconUrl', 'IconUrl') ?? null,
      builds: Number(readField<number>(raw, 'builds', 'Builds') ?? 0),
      averagePlacement: Number(readField<number>(raw, 'averagePlacement', 'AveragePlacement') ?? 0)
    };
  });
}

function normalizeTopCompGroups(entries: unknown[] | undefined): GroupTopComp[] {
  return (entries ?? []).map((entry) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    return {
      key: readField<string>(raw, 'key', 'Key') ?? '',
      title: readField<string>(raw, 'title', 'Title') ?? 'Unknown comp',
      units: normalizeStringArray(readField<unknown[]>(raw, 'units', 'Units')),
      traits: normalizeStringArray(readField<unknown[]>(raw, 'traits', 'Traits')),
      games: Number(readField<number>(raw, 'games', 'Games') ?? 0),
      averagePlacement: Number(readField<number>(raw, 'averagePlacement', 'AveragePlacement') ?? 0)
    };
  });
}

function normalizeStringArray(entries: unknown[] | undefined): string[] {
  return (entries ?? []).map((entry) => `${entry ?? ''}`).filter((entry) => entry.length > 0);
}

function buildGroupsFromMatches(recap: RecapResponse): RecapResponse['groups'] {
  const championMap = new Map<string, { id: string; name: string; iconUrl?: string | null; games: number; placementTotal: number; top4s: number }>();
  const synergyMap = new Map<string, { id: string; name: string; iconUrl?: string | null; appearances: number; placementTotal: number; wins: number }>();
  const itemMap = new Map<string, { id: string; name: string; iconUrl?: string | null; builds: number; placementTotal: number }>();
  const topCompMap = new Map<string, { key: string; title: string; units: string[]; traits: string[]; games: number; placementTotal: number }>();

  for (const match of recap.matches) {
    for (const unit of match.units) {
      const current = championMap.get(unit.id) ?? { id: unit.id, name: unit.name, iconUrl: unit.iconUrl, games: 0, placementTotal: 0, top4s: 0 };
      current.games += 1;
      current.placementTotal += match.placement;
      current.top4s += match.placement <= 4 ? 1 : 0;
      championMap.set(unit.id, current);
    }

    for (const trait of match.traits) {
      const current = synergyMap.get(trait.id) ?? { id: trait.id, name: trait.name, iconUrl: trait.iconUrl, appearances: 0, placementTotal: 0, wins: 0 };
      current.appearances += 1;
      current.placementTotal += match.placement;
      current.wins += match.placement === 1 ? 1 : 0;
      synergyMap.set(trait.id, current);
    }

    for (const item of match.items) {
      const current = itemMap.get(item.id) ?? { id: item.id, name: item.name, iconUrl: item.iconUrl, builds: 0, placementTotal: 0 };
      current.builds += 1;
      current.placementTotal += match.placement;
      itemMap.set(item.id, current);
    }

    const traits = [...match.traits]
      .sort((left, right) => (right.style - left.style) || (right.numUnits - left.numUnits) || left.name.localeCompare(right.name))
      .slice(0, 3)
      .map((trait) => trait.name);
    const units = match.units.slice(0, 4).map((unit) => unit.name);
    const key = traits.join(' + ') || units.slice(0, 2).join(', ');

    if (key) {
      const current = topCompMap.get(key) ?? { key, title: key, units, traits, games: 0, placementTotal: 0 };
      current.games += 1;
      current.placementTotal += match.placement;
      topCompMap.set(key, current);
    }
  }

  const placements = recap.matches.map((match) => match.placement).filter((placement) => placement > 0);

  return {
    performanceOverview: {
      totalGames: recap.summary.totalGames,
      wins: recap.summary.wins,
      top4s: recap.summary.top4s,
      averagePlacement: recap.summary.averagePlacement,
      totalDamage: recap.summary.totalPlayerDamage,
      bestPlacement: placements.length > 0 ? Math.min(...placements) : 0,
      worstPlacement: placements.length > 0 ? Math.max(...placements) : 0
    },
    champions: [...championMap.values()]
      .sort((left, right) => right.games - left.games || (left.placementTotal / left.games) - (right.placementTotal / right.games))
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        iconUrl: entry.iconUrl,
        games: entry.games,
        averagePlacement: Number((entry.placementTotal / entry.games).toFixed(2)),
        top4s: entry.top4s
      })),
    synergies: [...synergyMap.values()]
      .sort((left, right) => (left.placementTotal / left.appearances) - (right.placementTotal / right.appearances) || right.appearances - left.appearances)
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        iconUrl: entry.iconUrl,
        appearances: entry.appearances,
        averagePlacement: Number((entry.placementTotal / entry.appearances).toFixed(2)),
        wins: entry.wins
      })),
    placementDistribution: Array.from({ length: 8 }, (_, index) => ({
      placement: index + 1,
      games: recap.matches.filter((match) => match.placement === index + 1).length
    })),
    items: [...itemMap.values()]
      .sort((left, right) => right.builds - left.builds || (left.placementTotal / left.builds) - (right.placementTotal / right.builds))
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        iconUrl: entry.iconUrl,
        builds: entry.builds,
        averagePlacement: Number((entry.placementTotal / entry.builds).toFixed(2))
      })),
    topComps: [...topCompMap.values()]
      .sort((left, right) => (left.placementTotal / left.games) - (right.placementTotal / right.games) || right.games - left.games)
      .slice(0, 6)
      .map((entry) => ({
        key: entry.key,
        title: entry.title,
        units: entry.units,
        traits: entry.traits,
        games: entry.games,
        averagePlacement: Number((entry.placementTotal / entry.games).toFixed(2))
      }))
  };
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="landing-shell">
    <canvas class="scene" aria-hidden="true"></canvas>
    <div class="vignette"></div>
    <section class="form-shell" aria-live="polite">
      <form class="recap-card" aria-label="TFT recap request form">
        <p class="form-kicker">Arrival confirmed</p>
        <h1>Riot Auralis</h1>
        <p class="form-copy">
          Plot a course through your TFT match history with a solar recap built from your recent games.
        </p>
        <div class="form-grid">
          <label>
            <span>Riot ID</span>
            <input type="text" name="riotId" placeholder="PenguDiff" maxlength="32" required />
          </label>
          <label>
            <span>Tagline</span>
            <input type="text" name="tagline" placeholder="NA1" maxlength="8" required />
          </label>
          <label>
            <span>Region</span>
            <select name="region" class="region-select" required></select>
          </label>
          <label>
            <span>Days</span>
            <select name="days" required>
              <option value="1">1 day</option>
              <option value="2">2 days</option>
              <option value="3">3 days</option>
              <option value="4">4 days</option>
              <option value="5">5 days</option>
              <option value="6">6 days</option>
              <option value="7">7 days</option>
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="launch-button">Generate solar recap</button>
          <p class="status-text" data-role="status">Loading region routes...</p>
        </div>
      </form>
    </section>
    <section class="recap-shell" aria-live="polite">
      <div class="recap-sun-label">
        <p class="eyebrow">Solar arrival</p>
        <h2 class="player-heading">Awaiting signal</h2>
        <p class="player-subheading">Your recap will materialize around the sun.</p>
      </div>
      <section class="solar-capsule-layer" aria-live="polite"></section>
      <aside class="solar-group-nav" aria-label="Recap groups"></aside>
      <button type="button" class="scene-shift-button">View Earth</button>
    </section>
    <section class="audio-shell" aria-label="Audio controls">
      <label class="volume-control">
        <div class="audio-control-head">
          <span>Volume</span>
          <div class="audio-button-row">
            <button type="button" class="audio-button audio-button-play" data-audio-action="play" aria-label="Play">▶</button>
            <button type="button" class="audio-button" data-audio-action="pause" aria-label="Pause">❚❚</button>
            <button type="button" class="audio-button" data-audio-action="next" aria-label="Next track">⏭</button>
          </div>
        </div>
        <input class="volume-slider" type="range" min="0" max="100" value="40" />
      </label>
    </section>
  </main>
`;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element was not found: ${selector}`);
  }

  return element;
}

const canvas = requireElement<HTMLCanvasElement>('.scene');
const formShell = requireElement<HTMLElement>('.form-shell');
const recapForm = requireElement<HTMLFormElement>('.recap-card');
const regionSelect = requireElement<HTMLSelectElement>('.region-select');
const statusText = requireElement<HTMLElement>('[data-role="status"]');
const volumeSlider = requireElement<HTMLInputElement>('.volume-slider');
const audioButtons = document.querySelectorAll<HTMLButtonElement>('[data-audio-action]');
const recapShell = requireElement<HTMLElement>('.recap-shell');
const recapSunLabel = requireElement<HTMLElement>('.recap-sun-label');
const playerHeading = requireElement<HTMLElement>('.player-heading');
const playerSubheading = requireElement<HTMLElement>('.player-subheading');
const solarCapsuleLayer = requireElement<HTMLElement>('.solar-capsule-layer');
const solarGroupNav = requireElement<HTMLElement>('.solar-group-nav');
const sceneShiftButton = requireElement<HTMLButtonElement>('.scene-shift-button');

const riotIdInput = recapForm.elements.namedItem('riotId');
const taglineInput = recapForm.elements.namedItem('tagline');
const daysInput = recapForm.elements.namedItem('days');
if (!(riotIdInput instanceof HTMLInputElement) || !(taglineInput instanceof HTMLInputElement) || !(daysInput instanceof HTMLSelectElement)) {
  throw new Error('Required form inputs were not found.');
}

const soundtrackPlaylist = [soundtrackUrl, soundtrackAltUrl];
let soundtrackIndex = 0;
const soundtrack = new Audio(soundtrackPlaylist[soundtrackIndex]);
soundtrack.loop = true;
soundtrack.volume = 0.4;

function loadSoundtrack(index: number, shouldPlay: boolean) {
  soundtrackIndex = (index + soundtrackPlaylist.length) % soundtrackPlaylist.length;
  const wasPaused = soundtrack.paused;
  soundtrack.src = soundtrackPlaylist[soundtrackIndex];
  soundtrack.load();

  if (shouldPlay || !wasPaused) {
    void soundtrack.play().catch(() => {
      // Playback can still be blocked until user interaction.
    });
  }
}

function tryStartSoundtrack() {
  void soundtrack.play().catch(() => {
    const startOnInteraction = () => {
      void soundtrack.play().finally(() => {
        window.removeEventListener('pointerdown', startOnInteraction);
        window.removeEventListener('keydown', startOnInteraction);
      });
    };

    window.addEventListener('pointerdown', startOnInteraction, { once: true });
    window.addEventListener('keydown', startOnInteraction, { once: true });
  });
}

tryStartSoundtrack();

volumeSlider.addEventListener('input', () => {
  soundtrack.volume = Number(volumeSlider.value) / 100;
});

for (const button of audioButtons) {
  button.addEventListener('click', () => {
    const action = button.dataset.audioAction;

    if (action === 'play') {
      void soundtrack.play().catch(() => {
        // Playback can still be blocked until user interaction.
      });
      return;
    }

    if (action === 'pause') {
      soundtrack.pause();
      return;
    }

    if (action === 'next') {
      loadSoundtrack(soundtrackIndex + 1, true);
    }
  });
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const sceneFog = new THREE.FogExp2(0x01040a, 0.014);
scene.fog = sceneFog;

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 320);
camera.position.z = 6;

const starTexture = createStarTexture();
const earthTexture = createEarthTexture();
const cloudTexture = createCloudTexture();

type StarLayer = {
  positions: Float32Array;
  mesh: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  speed: number;
  resetZ: number;
  frontZ: number;
  spread: number;
  radialPush: number;
  spawnRadius: number;
  boundsX: number;
  boundsY: number;
  baseColor: THREE.Color;
  warmColor: THREE.Color;
};

type StreakLayer = {
  positions: Float32Array;
  mesh: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  speed: number;
  resetZ: number;
  frontZ: number;
  spread: number;
  tail: number;
  radialPush: number;
  spawnRadius: number;
  boundsX: number;
  boundsY: number;
  baseColor: THREE.Color;
  warmColor: THREE.Color;
};

const starLayers: StarLayer[] = [];
const streakLayers: StreakLayer[] = [];
const fallbackRegions: RegionOption[] = [
  { key: 'na1', displayName: 'North America' },
  { key: 'br1', displayName: 'Brazil' },
  { key: 'la1', displayName: 'LAN' },
  { key: 'la2', displayName: 'LAS' },
  { key: 'euw1', displayName: 'EU West' },
  { key: 'eun1', displayName: 'EU Nordic & East' },
  { key: 'tr1', displayName: 'Turkey' },
  { key: 'ru', displayName: 'Russia' },
  { key: 'kr', displayName: 'Korea' },
  { key: 'jp1', displayName: 'Japan' },
  { key: 'oc1', displayName: 'Oceania' }
];
const bgTopColor = new THREE.Color('#010208');
const bgBottomColor = new THREE.Color('#020611');
const sunTopColor = new THREE.Color('#2a1205');
const sunBottomColor = new THREE.Color('#120400');
const earthTopColor = new THREE.Color('#071827');
const earthBottomColor = new THREE.Color('#04101b');
const fogStart = new THREE.Color(0x01040a);
const fogEnd = new THREE.Color(0x2f1204);
const fogEarth = new THREE.Color(0x0d2034);
const volumeBorderStart = new THREE.Color('#a8ceff');
const volumeBorderEnd = new THREE.Color('#ffc67e');
const volumeBorderEarth = new THREE.Color('#7ccfff');
const volumeTopStart = new THREE.Color('#0b1730');
const volumeTopEnd = new THREE.Color('#2a1205');
const volumeTopEarth = new THREE.Color('#10243c');
const volumeBottomStart = new THREE.Color('#050c18');
const volumeBottomEnd = new THREE.Color('#140704');
const volumeBottomEarth = new THREE.Color('#08131f');
const volumeGlowStart = new THREE.Color('#98defd');
const volumeGlowEnd = new THREE.Color('#ffb062');
const volumeGlowEarth = new THREE.Color('#72ccff');
const volumeBaseStart = new THREE.Color('#040a16');
const volumeBaseEnd = new THREE.Color('#120906');
const volumeBaseEarth = new THREE.Color('#06111b');
const volumeLabelStart = new THREE.Color('#b4ddff');
const volumeLabelEnd = new THREE.Color('#ffd7a1');
const volumeLabelEarth = new THREE.Color('#dff5ff');
const volumeAccentStart = new THREE.Color('#9adfff');
const volumeAccentEnd = new THREE.Color('#ffba6d');
const volumeAccentEarth = new THREE.Color('#71cbff');
const panelBorderStart = new THREE.Color('#ffcc93');
const panelBorderEarth = new THREE.Color('#8fd5ff');
const panelGlowStart = new THREE.Color('#ffb062');
const panelGlowEarth = new THREE.Color('#69bfff');
const panelTopStart = new THREE.Color('#2a1208');
const panelTopEarth = new THREE.Color('#0d2136');
const panelBottomStart = new THREE.Color('#0e0704');
const panelBottomEarth = new THREE.Color('#07111c');
const buttonBorderStart = new THREE.Color('#ffc67e');
const buttonBorderEarth = new THREE.Color('#8bd6ff');
const buttonGlowStart = new THREE.Color('#ffb362');
const buttonGlowEarth = new THREE.Color('#7fcfff');
const buttonTopStart = new THREE.Color('#221008');
const buttonTopEarth = new THREE.Color('#102238');
const buttonBottomStart = new THREE.Color('#0c0706');
const buttonBottomEarth = new THREE.Color('#08111c');
const buttonTextStart = new THREE.Color('#fff0df');
const buttonTextEarth = new THREE.Color('#e6f7ff');
const topMixColor = new THREE.Color();
const bottomMixColor = new THREE.Color();
const fogMixColor = new THREE.Color();
const volumeBorderMixColor = new THREE.Color();
const volumeTopMixColor = new THREE.Color();
const volumeBottomMixColor = new THREE.Color();
const volumeGlowMixColor = new THREE.Color();
const volumeBaseMixColor = new THREE.Color();
const volumeLabelMixColor = new THREE.Color();
const volumeAccentMixColor = new THREE.Color();
const panelBorderMixColor = new THREE.Color();
const panelGlowMixColor = new THREE.Color();
const panelTopMixColor = new THREE.Color();
const panelBottomMixColor = new THREE.Color();
const buttonBorderMixColor = new THREE.Color();
const buttonGlowMixColor = new THREE.Color();
const buttonTopMixColor = new THREE.Color();
const buttonBottomMixColor = new THREE.Color();
const buttonTextMixColor = new THREE.Color();
const phaseColorA = new THREE.Color();
const tempColor = new THREE.Color();
let targetSceneProgress = 0;
let sceneProgress = 0;
let targetEarthProgress = 0;
let earthProgress = 0;

type MeteorStat = {
  title: string;
  value: string;
};

type ActiveMeteor = {
  group: THREE.Group;
  body: THREE.Group;
  glow: THREE.Sprite;
  trail: THREE.Line;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
};

const meteorStatsPool: MeteorStat[] = [];
const activeMeteors: ActiveMeteor[] = [];
const meteorLabelTextureCache = new Map<string, THREE.CanvasTexture>();
let meteorSequenceStarted = false;
let meteorSequenceActivatedAt = 0;
let nextMeteorSpawnAt = 0;

function createStarTexture(): THREE.CanvasTexture {
  const size = 64;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = size;
  textureCanvas.height = size;
  const ctx = textureCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('2D texture context unavailable.');
  }

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(223,238,255,0.95)');
  gradient.addColorStop(0.48, 'rgba(132,194,255,0.45)');
  gradient.addColorStop(1, 'rgba(132,194,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  return texture;
}

function createEarthTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;
  const ctx = textureCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('2D texture context unavailable.');
  }

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#2d7cb5');
  ocean.addColorStop(0.52, '#155388');
  ocean.addColorStop(1, '#102f57');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  const drawLand = (x: number, y: number, rx: number, ry: number, rotation: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(rx, ry);
    ctx.beginPath();
    ctx.moveTo(0.1, -0.9);
    ctx.bezierCurveTo(0.9, -0.9, 1.1, -0.2, 0.7, 0.2);
    ctx.bezierCurveTo(1, 0.9, 0.4, 1.1, -0.2, 0.8);
    ctx.bezierCurveTo(-0.9, 0.7, -1.1, 0.1, -0.7, -0.5);
    ctx.bezierCurveTo(-0.5, -0.9, -0.1, -1.1, 0.1, -0.9);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  drawLand(width * 0.22, height * 0.26, 86, 96, -0.22, '#79be58');
  drawLand(width * 0.29, height * 0.48, 54, 98, 0.15, '#6fb14f');
  drawLand(width * 0.39, height * 0.2, 42, 30, -0.1, '#8ccf65');
  drawLand(width * 0.48, height * 0.26, 62, 38, 0.18, '#7fc35b');
  drawLand(width * 0.56, height * 0.28, 146, 78, 0.1, '#86c963');
  drawLand(width * 0.69, height * 0.4, 92, 60, -0.06, '#6ba74a');
  drawLand(width * 0.74, height * 0.58, 58, 34, 0.08, '#7fbe56');
  drawLand(width * 0.78, height * 0.72, 50, 30, 0.1, '#9ed972');
  drawLand(width * 0.58, height * 0.72, 108, 26, -0.04, '#9fdc70');
  drawLand(width * 0.47, height * 0.64, 52, 20, 0.02, '#7dbc54');

  const polar = ctx.createLinearGradient(0, 0, 0, height);
  polar.addColorStop(0, 'rgba(255,255,255,0.82)');
  polar.addColorStop(0.12, 'rgba(255,255,255,0)');
  polar.addColorStop(0.88, 'rgba(255,255,255,0)');
  polar.addColorStop(1, 'rgba(255,255,255,0.76)');
  ctx.fillStyle = polar;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  return texture;
}

function createCloudTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;
  const ctx = textureCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('2D texture context unavailable.');
  }

  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < 42; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const rx = 40 + Math.random() * 110;
    const ry = 12 + Math.random() * 32;
    const rotation = (Math.random() - 0.5) * 0.8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    const gradient = ctx.createRadialGradient(0, 0, 8, 0, 0, rx);
    gradient.addColorStop(0, 'rgba(255,255,255,0.34)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  return texture;
}

function respawnPoint(positions: Float32Array, index: number, spread: number, z: number, spawnRadius: number) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * spread * 0.54 * spawnRadius;
  positions[index] = Math.cos(angle) * radius;
  positions[index + 1] = Math.sin(angle) * radius * 0.62;
  positions[index + 2] = z;
}

function createStarLayer(
  count: number,
  spread: number,
  size: number,
  speed: number,
  color: number,
  depth: number,
  frontZ: number,
  opacity: number,
  radialPush: number,
  spawnRadius: number,
  warmColor: number
) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    respawnPoint(positions, i * 3, spread, -Math.random() * depth, spawnRadius);
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);

  const material = new THREE.PointsMaterial({
    map: starTexture,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color
  });

  const mesh = new THREE.Points(geometry, material);
  scene.add(mesh);
  starLayers.push({
    positions,
    mesh,
    speed,
    resetZ: -depth,
    frontZ,
    spread,
    radialPush,
    spawnRadius,
    boundsX: spread * 1.6,
    boundsY: spread * 1.08,
    baseColor: new THREE.Color(color),
    warmColor: new THREE.Color(warmColor)
  });
}

function createStreakLayer(
  count: number,
  spread: number,
  tail: number,
  speed: number,
  color: number,
  depth: number,
  frontZ: number,
  opacity: number,
  radialPush: number,
  spawnRadius: number,
  warmColor: number
) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 6);

  for (let i = 0; i < count; i += 1) {
    const index = i * 6;
    const x = (Math.random() - 0.5) * spread * spawnRadius;
    const y = (Math.random() - 0.5) * spread * 0.58 * spawnRadius;
    const z = -Math.random() * depth;
    positions[index] = x;
    positions[index + 1] = y;
    positions[index + 2] = z;
    positions[index + 3] = x;
    positions[index + 4] = y;
    positions[index + 5] = z - tail;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);

  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: 2,
    transparent: true,
    opacity: Math.min(opacity + 0.12, 1),
    blending: THREE.AdditiveBlending
  });

  const mesh = new THREE.LineSegments(geometry, material);
  scene.add(mesh);
  streakLayers.push({
    positions,
    mesh,
    speed,
    resetZ: -depth,
    frontZ,
    spread,
    tail,
    radialPush,
    spawnRadius,
    boundsX: spread * 1.3,
    boundsY: spread * 0.92,
    baseColor: new THREE.Color(color),
    warmColor: new THREE.Color(warmColor)
  });
}

createStarLayer(7200, 260, 0.14, 0.11, 0x93b7ff, 320, 14, 0.34, 0.003, 1, 0xffd29a);
createStarLayer(3600, 110, 0.38, 0.54, 0xe5f2ff, 120, 18, 0.92, 0.036, 0.18, 0xfff1dc);
createStreakLayer(90, 26, 18, 1.7, 0xb8e2ff, 36, 20, 0.56, 0.092, 0.06, 0xffc97d);

const sunGroup = new THREE.Group();
sunGroup.position.set(0, -0.2, -85);
scene.add(sunGroup);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(11, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0xffbc5e,
    transparent: true,
    opacity: 0
  })
);
sunGroup.add(sun);

const sunCorona = new THREE.Mesh(
  new THREE.SphereGeometry(13.2, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0xff8f2f,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
sunGroup.add(sunCorona);

const sunGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: starTexture,
    color: 0xff9b36,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
sunGlow.scale.set(72, 72, 1);
sunGroup.add(sunGlow);

const sunOuterGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: starTexture,
    color: 0xffd38d,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
sunOuterGlow.scale.set(112, 112, 1);
sunGroup.add(sunOuterGlow);

const earthGroup = new THREE.Group();
earthGroup.position.set(0, 0.15, -58);
scene.add(earthGroup);

const earthLightRig = new THREE.Group();
earthGroup.add(earthLightRig);

const earthAmbientLight = new THREE.AmbientLight(0xa6d8ff, 0);
earthLightRig.add(earthAmbientLight);

const earthKeyLight = new THREE.DirectionalLight(0xc4ebff, 0);
earthKeyLight.position.set(18, 10, 20);
earthLightRig.add(earthKeyLight);

const earthRimLight = new THREE.PointLight(0x2b8ee8, 0, 120, 2);
earthRimLight.position.set(-15, -8, -18);
earthLightRig.add(earthRimLight);

const earthCore = new THREE.Mesh(
  new THREE.SphereGeometry(10.6, 64, 64),
  new THREE.MeshPhongMaterial({
    map: earthTexture,
    color: 0xf8fdff,
    emissive: 0x04111b,
    emissiveIntensity: 0.02,
    shininess: 16,
    specular: new THREE.Color('#5ca6d9')
  })
);
earthGroup.add(earthCore);

const earthClouds = new THREE.Mesh(
  new THREE.SphereGeometry(10.78, 48, 48),
  new THREE.MeshPhongMaterial({
    map: cloudTexture,
    color: 0xeef8ff,
    transparent: true,
    opacity: 0,
    blending: THREE.NormalBlending,
    depthWrite: false
  })
);
earthGroup.add(earthClouds);

const earthAtmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(11.08, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0x4fb4ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
earthGroup.add(earthAtmosphere);

const earthOuterAtmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(11.42, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0x8fe1ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
earthGroup.add(earthOuterAtmosphere);

const earthGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: starTexture,
    color: 0x67beff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
earthGlow.scale.set(34, 34, 1);
earthGroup.add(earthGlow);

sceneShiftButton.addEventListener('click', () => {
  if (targetEarthProgress >= 0.5) {
    targetEarthProgress = 0;
    recapShell.classList.remove('is-earth', 'is-earth-travel');
    sceneShiftButton.textContent = 'View Earth';
    clearMeteorSequence();

    if (currentRecap) {
      playerSubheading.textContent = `${resolveRegionLabel(regionSelect, currentRecap.player.region)} | ${currentRecap.range.days}-day scan window`;
    }

    return;
  }

  targetEarthProgress = 1;
  recapShell.classList.add('is-earth', 'is-earth-travel');
  clearSpawnedCapsules();
  sceneShiftButton.textContent = 'View Sun';
  startMeteorSequence();
});

window.setTimeout(() => {
  formShell.classList.add('is-visible');
}, 1500);

async function loadRegions() {
  try {
    setStatus('Loading region routes...');
    const response = await fetch(`${API_BASE_URL}/api/regions`);
    if (!response.ok) {
      throw new Error('Unable to load regions.');
    }

    const payload = await response.json() as RegionOptionApi[];
    const regions = payload
      .map(normalizeRegionOption)
      .filter((region): region is RegionOption => region !== null);

    if (regions.length === 0) {
      throw new Error('Region list came back empty.');
    }

    populateRegions(regions);
    setStatus('Signal locked. Ready to generate a recap.');
  } catch (error) {
    populateRegions(fallbackRegions);
    setStatus(
      `${error instanceof Error ? error.message : 'Unable to load regions.'} Using fallback region routes.`,
      true
    );
  }
}

function normalizeRegionOption(region: RegionOptionApi): RegionOption | null {
  const key = region.key ?? region.Key;
  const displayName = region.displayName ?? region.DisplayName;

  if (!key || !displayName) {
    return null;
  }

  return { key, displayName };
}

function populateRegions(regions: RegionOption[]) {
  regionSelect.innerHTML = regions
      .map((region) => `<option value="${escapeHtml(region.key)}">${escapeHtml(region.displayName)}</option>`)
      .join('');
}

function setStatus(message: string, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle('is-error', isError);
}

recapForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Consulting the stars...');

  const payload = {
    riotId: riotIdInput.value.trim(),
    tagline: taglineInput.value.trim(),
    region: regionSelect.value,
    days: Number(daysInput.value)
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/recap/yearly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.message ?? 'Unable to generate recap.');
    }

    renderRecap(normalizeRecapResponse(body));
    targetSceneProgress = 1;
    formShell.classList.add('is-transitioning');
    recapShell.classList.add('is-visible');
    setStatus('Recap generated.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to generate recap.', true);
  }
});

function renderRecap(recap: RecapResponse) {
  currentRecap = recap;
  clearSpawnedCapsules();
  playerHeading.textContent = `${recap.player.riotId} #${recap.player.tagline}`;
  playerSubheading.textContent = `${resolveRegionLabel(regionSelect, recap.player.region)} | ${recap.range.days}-day scan window`;
  renderGroupNavigation(recap);
}

function renderGroupNavigation(recap: RecapResponse) {
  const groups: RecapGroupKey[] = ['performanceOverview', 'champions', 'synergies', 'placementDistribution', 'items', 'topComps'];
  solarGroupNav.innerHTML = groups
    .map((groupKey, index) => {
      const countLabel = getGroupCountLabel(groupKey, recap);

      return `
        <button
          type="button"
          class="solar-group-button${index === 0 ? ' is-active' : ''}"
          data-group-key="${groupKey}"
        >
          <span class="solar-group-button-label">${escapeHtml(groupLabels[groupKey])}</span>
          <span class="solar-group-button-meta">${escapeHtml(countLabel)}</span>
        </button>
      `;
    })
    .join('');

  const buttons = solarGroupNav.querySelectorAll<HTMLButtonElement>('.solar-group-button');
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const groupKey = button.dataset.groupKey as RecapGroupKey | undefined;
      if (!groupKey) {
        return;
      }
      spawnGroupCapsule(groupKey, recap);
    });
  }
}

function getGroupCountLabel(groupKey: RecapGroupKey, recap: RecapResponse) {
  switch (groupKey) {
    case 'performanceOverview':
      return `${recap.groups.performanceOverview.totalGames} games`;
    case 'champions':
      return `${recap.groups.champions.length} tracked`;
    case 'synergies':
      return `${recap.groups.synergies.length} tracked`;
    case 'placementDistribution':
      return '1 through 8';
    case 'items':
      return `${recap.groups.items.length} tracked`;
    case 'topComps':
      return `${recap.groups.topComps.length} signatures`;
  }
}

function spawnGroupCapsule(groupKey: RecapGroupKey, recap: RecapResponse) {
  const existing = spawnedCapsules.get(groupKey);
  if (existing) {
    focusCapsule(existing.element);
    return;
  }

  const capsule = document.createElement('article');
  capsule.className = 'solar-display-card solar-scene-capsule is-centered';
  capsule.dataset.groupKey = groupKey;
  capsule.innerHTML = `
    <div class="solar-display-head">
      <div>
        <p class="solar-display-kicker">Signal archive</p>
        <h3 class="solar-display-title">${escapeHtml(groupLabels[groupKey])}</h3>
      </div>
      <button type="button" class="solar-capsule-close" aria-label="Close ${escapeAttribute(groupLabels[groupKey])} capsule">×</button>
    </div>
    <div class="solar-display-body">${getGroupContentMarkup(groupKey, recap)}</div>
    <button type="button" class="solar-capsule-resize" aria-label="Resize ${escapeAttribute(groupLabels[groupKey])} capsule"></button>
  `;

  const closeButton = capsule.querySelector<HTMLButtonElement>('.solar-capsule-close');
  const head = capsule.querySelector<HTMLElement>('.solar-display-head');
  const resizeHandle = capsule.querySelector<HTMLButtonElement>('.solar-capsule-resize');
  if (closeButton) {
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeGroupCapsule(groupKey);
    });
  }

  if (head) {
    initializeDraggableCapsule(capsule, head, groupKey);
  }
  if (resizeHandle) {
    initializeResizableCapsule(capsule, resizeHandle, groupKey);
  }

  const initialAnchor = getInitialCapsuleAnchor();
  capsule.style.left = `${initialAnchor.x}px`;
  capsule.style.top = `${initialAnchor.y}px`;

  capsule.addEventListener('pointerdown', () => {
    focusCapsule(capsule);
  });

  solarCapsuleLayer.append(capsule);
  const state: SpawnedCapsuleState = {
    element: capsule,
    moved: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
  spawnedCapsules.set(groupKey, state);
  setGroupButtonState(groupKey, true);
  focusCapsule(capsule);
}

function getInitialCapsuleAnchor() {
  const shellRect = recapShell.getBoundingClientRect();
  const labelRect = recapSunLabel.getBoundingClientRect();
  const rootStyles = getComputedStyle(document.documentElement);
  const focusYValue = rootStyles.getPropertyValue('--solar-focus-y').trim();
  const focusYPercent = Number.parseFloat(focusYValue);
  const focusY = Number.isFinite(focusYPercent) ? (shellRect.height * focusYPercent) / 100 : shellRect.height / 2;

  return {
    x: labelRect.left + (labelRect.width / 2) - shellRect.left,
    y: focusY
  };
}

function closeGroupCapsule(groupKey: RecapGroupKey) {
  const state = spawnedCapsules.get(groupKey);
  if (!state) {
    return;
  }

  state.element.remove();
  spawnedCapsules.delete(groupKey);
  setGroupButtonState(groupKey, false);
}

function clearSpawnedCapsules() {
  for (const state of spawnedCapsules.values()) {
    state.element.remove();
  }

  spawnedCapsules.clear();
  solarCapsuleLayer.innerHTML = '';
  const buttons = solarGroupNav.querySelectorAll<HTMLButtonElement>('.solar-group-button');
  for (const button of buttons) {
    button.classList.remove('is-active');
  }
}

function setGroupButtonState(groupKey: RecapGroupKey, isActive: boolean) {
  const button = solarGroupNav.querySelector<HTMLButtonElement>(`.solar-group-button[data-group-key="${groupKey}"]`);
  button?.classList.toggle('is-active', isActive);
}

function focusCapsule(capsule: HTMLElement) {
  nextCapsuleZIndex += 1;
  capsule.style.zIndex = `${nextCapsuleZIndex}`;
}

function initializeDraggableCapsule(capsule: HTMLElement, handle: HTMLElement, groupKey: RecapGroupKey) {
  handle.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.solar-capsule-close')) {
      return;
    }

    const state = spawnedCapsules.get(groupKey);
    if (!state) {
      return;
    }

    const shellRect = recapShell.getBoundingClientRect();
    const capsuleRect = capsule.getBoundingClientRect();
    const offsetX = event.clientX - capsuleRect.left;
    const offsetY = event.clientY - capsuleRect.top;

    if (!state.moved) {
      state.moved = true;
      state.x = capsuleRect.left - shellRect.left;
      state.y = capsuleRect.top - shellRect.top;
      capsule.classList.remove('is-centered');
      capsule.style.left = `${state.x}px`;
      capsule.style.top = `${state.y}px`;
      capsule.style.transform = 'none';
    }

    focusCapsule(capsule);
    capsule.classList.add('is-dragging');
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();

    const move = (moveEvent: PointerEvent) => {
      const boundsRect = recapShell.getBoundingClientRect();
      const currentRect = capsule.getBoundingClientRect();
      const maxX = Math.max(boundsRect.width - currentRect.width, 0);
      const maxY = Math.max(boundsRect.height - currentRect.height, 0);
      const nextX = THREE.MathUtils.clamp(moveEvent.clientX - boundsRect.left - offsetX, 0, maxX);
      const nextY = THREE.MathUtils.clamp(moveEvent.clientY - boundsRect.top - offsetY, 0, maxY);

      state.x = nextX;
      state.y = nextY;
      capsule.style.left = `${nextX}px`;
      capsule.style.top = `${nextY}px`;
    };

    const stop = () => {
      capsule.classList.remove('is-dragging');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  });
}

function initializeResizableCapsule(capsule: HTMLElement, handle: HTMLElement, groupKey: RecapGroupKey) {
  handle.addEventListener('pointerdown', (event) => {
    const state = spawnedCapsules.get(groupKey);
    if (!state) {
      return;
    }

    const shellRect = recapShell.getBoundingClientRect();
    const capsuleRect = capsule.getBoundingClientRect();
    const startWidth = capsuleRect.width;
    const startHeight = capsuleRect.height;
    const startX = event.clientX;
    const startY = event.clientY;

    if (!state.moved) {
      state.moved = true;
      state.x = capsuleRect.left - shellRect.left;
      state.y = capsuleRect.top - shellRect.top;
      capsule.classList.remove('is-centered');
      capsule.style.left = `${state.x}px`;
      capsule.style.top = `${state.y}px`;
      capsule.style.transform = 'none';
    }

    state.width = startWidth;
    state.height = startHeight;
    focusCapsule(capsule);
    capsule.classList.add('is-resizing');
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();

    const move = (moveEvent: PointerEvent) => {
      const boundsRect = recapShell.getBoundingClientRect();
      const minWidth = Math.min(320, boundsRect.width);
      const minHeight = 220;
      const maxWidth = Math.max(boundsRect.width - state.x, minWidth);
      const maxHeight = Math.max(boundsRect.height - state.y, minHeight);
      const nextWidth = THREE.MathUtils.clamp(startWidth + (moveEvent.clientX - startX), minWidth, maxWidth);
      const nextHeight = THREE.MathUtils.clamp(startHeight + (moveEvent.clientY - startY), minHeight, maxHeight);

      state.width = nextWidth;
      state.height = nextHeight;
      capsule.style.width = `${nextWidth}px`;
      capsule.style.maxHeight = `${nextHeight}px`;
      capsule.style.minHeight = `${Math.min(nextHeight, minHeight)}px`;
      capsule.style.height = `${nextHeight}px`;
    };

    const stop = () => {
      capsule.classList.remove('is-resizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  });
}

function getGroupContentMarkup(groupKey: RecapGroupKey, recap: RecapResponse) {
  switch (groupKey) {
    case 'performanceOverview':
      return renderPerformanceOverview(recap);
    case 'champions':
      return renderChampionGroup(recap.groups.champions);
    case 'synergies':
      return renderSynergyGroup(recap.groups.synergies);
    case 'placementDistribution':
      return renderPlacementDistributionGroup(recap.groups.placementDistribution);
    case 'items':
      return renderItemGroup(recap.groups.items);
    case 'topComps':
      return renderTopCompsGroup(recap.groups.topComps);
  }
}

function renderPerformanceOverview(recap: RecapResponse) {
  const overview = recap.groups.performanceOverview;
  const metrics = [
    { label: 'Games', value: `${overview.totalGames}` },
    { label: 'Wins', value: `${overview.wins}` },
    { label: 'Top 4s', value: `${overview.top4s}` },
    { label: 'Avg Place', value: overview.averagePlacement.toFixed(2) },
    { label: 'Damage', value: `${Math.round(overview.totalDamage)}` },
    { label: 'Best Finish', value: overview.bestPlacement > 0 ? `#${overview.bestPlacement}` : 'None' }
  ];
  const notes = [
    overview.worstPlacement > 0 ? `Worst finish #${overview.worstPlacement}` : 'No placements yet',
    `${recap.meta.processedMatchCount}/${recap.meta.requestedMatchCount} matches scanned`,
    formatRange(recap.range.startUtc, recap.range.endUtc)
  ];

  if (recap.meta.rateLimitReached) {
    notes.push('Rate limit shortened the full archive');
  }

  return `
    <div class="solar-grid-metrics">
      ${metrics
        .map((metric) => `
          <article class="solar-metric-tile">
            <span class="solar-metric-label">${escapeHtml(metric.label)}</span>
            <strong>${escapeHtml(metric.value)}</strong>
          </article>
        `)
        .join('')}
    </div>
    <div class="solar-inline-note-row">
      ${notes.map((note) => `<p class="solar-inline-note">${escapeHtml(note)}</p>`).join('')}
    </div>
    ${recap.meta.warnings.length > 0
      ? `<div class="solar-warning-stack">${recap.meta.warnings.map((warning) => `<p class="solar-inline-note is-warning">${escapeHtml(warning)}</p>`).join('')}</div>`
      : ''}
  `;
}

function renderChampionGroup(champions: GroupChampion[]) {
  return renderStatList(
    champions,
    'Champion data will appear once matches arrive.',
    (entry, index) => `
      <article class="solar-data-row">
        <div class="solar-data-rank">${index + 1}</div>
        <div class="solar-data-main">
          <div class="solar-data-identity">
            ${renderIcon(entry.iconUrl, entry.name)}
            <div>
              <strong>${escapeHtml(entry.name)}</strong>
              <span>${entry.games} games played</span>
            </div>
          </div>
          <div class="solar-data-meta">
            <span>Avg ${entry.averagePlacement.toFixed(2)}</span>
            <span>${entry.top4s} top 4s</span>
          </div>
        </div>
      </article>
    `
  );
}

function renderSynergyGroup(synergies: GroupSynergy[]) {
  return renderStatList(
    synergies,
    'Trait performance will show up after the first tracked games.',
    (entry, index) => `
      <article class="solar-data-row">
        <div class="solar-data-rank">${index + 1}</div>
        <div class="solar-data-main">
          <div class="solar-data-identity">
            ${renderIcon(entry.iconUrl, entry.name)}
            <div>
              <strong>${escapeHtml(entry.name)}</strong>
              <span>${entry.appearances} appearances</span>
            </div>
          </div>
          <div class="solar-data-meta">
            <span>Avg ${entry.averagePlacement.toFixed(2)}</span>
            <span>${entry.wins} wins</span>
          </div>
        </div>
      </article>
    `
  );
}

function renderPlacementDistributionGroup(distribution: GroupPlacementDistribution[]) {
  const maxGames = Math.max(...distribution.map((entry) => entry.games), 1);

  return `
    <div class="solar-placement-stack">
      ${distribution
        .map((entry) => {
          const width = `${Math.max((entry.games / maxGames) * 100, entry.games > 0 ? 8 : 0)}%`;

          return `
            <article class="solar-placement-row">
              <span class="solar-placement-label">#${entry.placement}</span>
              <div class="solar-placement-bar">
                <span style="width: ${width}"></span>
              </div>
              <span class="solar-placement-count">${entry.games} games</span>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderItemGroup(items: GroupItem[]) {
  return renderStatList(
    items,
    'Item build data will appear when itemized boards are found.',
    (entry, index) => `
      <article class="solar-data-row">
        <div class="solar-data-rank">${index + 1}</div>
        <div class="solar-data-main">
          <div class="solar-data-identity">
            ${renderIcon(entry.iconUrl, entry.name)}
            <div>
              <strong>${escapeHtml(entry.name)}</strong>
              <span>${entry.builds} builds</span>
            </div>
          </div>
          <div class="solar-data-meta">
            <span>Avg ${entry.averagePlacement.toFixed(2)}</span>
          </div>
        </div>
      </article>
    `
  );
}

function renderTopCompsGroup(topComps: GroupTopComp[]) {
  if (topComps.length === 0) {
    return '<p class="solar-empty-line">Top compositions will appear once enough boards are scanned.</p>';
  }

  return `
    <div class="solar-comp-stack">
      ${topComps
        .map((entry) => `
          <article class="solar-comp-card">
            <div class="solar-comp-head">
              <div>
                <strong>${escapeHtml(entry.title)}</strong>
                <span>${entry.games} games | Avg ${entry.averagePlacement.toFixed(2)}</span>
              </div>
            </div>
            <div class="solar-comp-detail-row">
              <p><span>Traits</span>${escapeHtml(entry.traits.join(', ') || 'None logged')}</p>
              <p><span>Units</span>${escapeHtml(entry.units.join(', ') || 'None logged')}</p>
            </div>
          </article>
        `)
        .join('')}
    </div>
  `;
}

function renderStatList<T>(entries: T[], emptyMessage: string, renderEntry: (entry: T, index: number) => string) {
  if (entries.length === 0) {
    return `<p class="solar-empty-line">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<div class="solar-data-list">${entries.map(renderEntry).join('')}</div>`;
}

function renderIcon(iconUrl: string | null | undefined, name: string) {
  if (iconUrl) {
    return `<img class="entity-icon" src="${escapeAttribute(iconUrl)}" alt="${escapeAttribute(name)}" loading="lazy" />`;
  }

  return `<div class="entity-icon entity-icon-fallback">${escapeHtml(name.slice(0, 1).toUpperCase())}</div>`;
}

function resolveRegionLabel(select: HTMLSelectElement, regionKey: string) {
  const option = [...select.options].find((entry) => entry.value === regionKey);
  return option?.textContent ?? regionKey.toUpperCase();
}

function formatLocalDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(date));
}

function formatRange(start: string, end: string) {
  return `${formatLocalDate(start)} - ${formatLocalDate(end)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function buildMeteorStats(recap: RecapResponse): MeteorStat[] {
  const stats: MeteorStat[] = [
    { title: 'Games scanned', value: `${recap.summary.totalGames}` },
    { title: 'Wins', value: `${recap.summary.wins}` },
    { title: 'Top 4 rate', value: recap.summary.totalGames > 0 ? `${Math.round((recap.summary.top4s / recap.summary.totalGames) * 100)}%` : '0%' },
    { title: 'Avg placement', value: recap.summary.averagePlacement.toFixed(2) },
    { title: 'Total damage', value: `${Math.round(recap.summary.totalPlayerDamage)}` },
    { title: 'Matches processed', value: `${recap.meta.processedMatchCount}/${recap.meta.requestedMatchCount}` }
  ];

  const topTrait = recap.groups.synergies[0];
  if (topTrait) {
    stats.push({ title: 'Best synergy', value: `${topTrait.name} avg ${topTrait.averagePlacement.toFixed(2)}` });
  }

  const topChampion = recap.groups.champions[0];
  if (topChampion) {
    stats.push({ title: 'Most played unit', value: `${topChampion.name} in ${topChampion.games} games` });
  }

  const topItem = recap.groups.items[0];
  if (topItem) {
    stats.push({ title: 'Most built item', value: `${topItem.name} x${topItem.builds}` });
  }

  const topComp = recap.groups.topComps[0];
  if (topComp) {
    stats.push({ title: 'Top comp', value: `${topComp.title} avg ${topComp.averagePlacement.toFixed(2)}` });
  }

  const bestPlacement = recap.groups.performanceOverview.bestPlacement;
  if (bestPlacement > 0) {
    stats.push({ title: 'Best finish', value: `#${bestPlacement}` });
  }

  return stats;
}

function createMeteorLabelTexture(stat: MeteorStat) {
  const cacheKey = `${stat.title}::${stat.value}`;
  const cachedTexture = meteorLabelTextureCache.get(cacheKey);
  if (cachedTexture) {
    return cachedTexture;
  }

  const width = 340;
  const height = 96;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;
  const ctx = textureCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('2D texture context unavailable.');
  }

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(138, 224, 255, 0.42)';
  ctx.lineWidth = 2;
  roundRect(ctx, 8, 8, width - 16, height - 16, 20);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(138, 224, 255, 0.26)';
  ctx.beginPath();
  ctx.moveTo(22, height / 2);
  ctx.lineTo(width - 22, height / 2);
  ctx.stroke();

  const glowGradient = ctx.createLinearGradient(0, 0, width, 0);
  glowGradient.addColorStop(0, 'rgba(98, 220, 255, 0)');
  glowGradient.addColorStop(0.18, 'rgba(98, 220, 255, 0.16)');
  glowGradient.addColorStop(0.5, 'rgba(98, 220, 255, 0.08)');
  glowGradient.addColorStop(0.82, 'rgba(98, 220, 255, 0.16)');
  glowGradient.addColorStop(1, 'rgba(98, 220, 255, 0)');
  ctx.fillStyle = glowGradient;
  roundRect(ctx, 10, 10, width - 20, height - 20, 18);
  ctx.fill();

  ctx.fillStyle = 'rgba(164, 238, 255, 0.86)';
  ctx.font = '600 15px Sora, sans-serif';
  ctx.fillText(stat.title.toUpperCase(), 22, 34);

  ctx.fillStyle = '#f4fdff';
  ctx.font = '700 24px Space Grotesk, sans-serif';
  ctx.fillText(stat.value, 22, 68);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  meteorLabelTextureCache.set(cacheKey, texture);
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function startMeteorSequence() {
  if (!currentRecap || meteorSequenceStarted) {
    return;
  }

  meteorStatsPool.splice(0, meteorStatsPool.length, ...buildMeteorStats(currentRecap));
  meteorSequenceStarted = true;
  meteorSequenceActivatedAt = performance.now() + 1500;
  nextMeteorSpawnAt = meteorSequenceActivatedAt;
}

function clearMeteorSequence() {
  meteorSequenceStarted = false;
  meteorSequenceActivatedAt = 0;
  nextMeteorSpawnAt = 0;

  for (const meteor of activeMeteors) {
    scene.remove(meteor.group);
    meteor.body.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const material of child.material) {
            material.dispose();
          }
        } else {
          child.material.dispose();
        }
      }
    });
    (meteor.glow.material as THREE.Material).dispose();
    (meteor.trail.geometry as THREE.BufferGeometry).dispose();
    (meteor.trail.material as THREE.Material).dispose();
    const labelMaterial = meteor.group.children[3] as THREE.Sprite;
    labelMaterial.material.dispose();
  }

  activeMeteors.splice(0, activeMeteors.length);
}

function spawnMeteor() {
  if (meteorStatsPool.length === 0) {
    return;
  }

  const stat = meteorStatsPool[Math.floor(Math.random() * meteorStatsPool.length)];
  const meteorGroup = new THREE.Group();
  meteorGroup.renderOrder = 10;
  const size = 0.84 + Math.random() * 0.26;
  const rockBody = new THREE.Mesh(
    new THREE.IcosahedronGeometry(size, 1),
    new THREE.MeshStandardMaterial({
      color: 0x8d949d,
      emissive: 0x24394b,
      emissiveIntensity: 0.22,
      roughness: 0.88,
      metalness: 0.04
    })
  );
  rockBody.scale.set(1.45, 1.05, 0.96);

  const body = new THREE.Group();
  body.add(rockBody);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTexture,
      color: 0x92dfff,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    })
  );
  glow.scale.set(5.4, 5.4, 1);

  const trailGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-4.2, 0.18, -0.14)
  ]);
  const trail = new THREE.Line(
    trailGeometry,
    new THREE.LineBasicMaterial({
      color: 0xbfeaff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthTest: false
    })
  );

  const labelTexture = createMeteorLabelTexture(stat);
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      depthTest: false
    })
  );
  label.scale.set(8.6, 2.45, 1);
  label.position.set(4.5, 1.55, 0);

  meteorGroup.add(trail);
  meteorGroup.add(glow);
  meteorGroup.add(body);
  meteorGroup.add(label);
  meteorGroup.position.set(30 + Math.random() * 18, 11 - Math.random() * 16, -9 - Math.random() * 4);
  meteorGroup.rotation.set(0.04 - Math.random() * 0.08, Math.random() * 0.45, 0.02 - Math.random() * 0.04);
  scene.add(meteorGroup);

  activeMeteors.push({
    group: meteorGroup,
    body,
    glow,
    trail,
    velocity: new THREE.Vector3(-4.8 - Math.random() * 2.2, -0.28 + Math.random() * 0.56, -0.08 + Math.random() * 0.16),
    spin: new THREE.Vector3(
      0.08 + Math.random() * 0.08,
      0.5 + Math.random() * 0.35,
      0.04 + Math.random() * 0.05
    )
  });
}

function updateMeteors(delta: number) {
  if (!meteorSequenceStarted) {
    return;
  }

  const now = performance.now();
  if (now < meteorSequenceActivatedAt) {
    return;
  }

  if (activeMeteors.length < 2 && now >= nextMeteorSpawnAt) {
    spawnMeteor();
    nextMeteorSpawnAt = now + 1500 + Math.random() * 1000;
  }

  for (let index = activeMeteors.length - 1; index >= 0; index -= 1) {
    const meteor = activeMeteors[index];
    meteor.group.position.addScaledVector(meteor.velocity, delta);
    meteor.body.rotation.x += delta * meteor.spin.x;
    meteor.body.rotation.y += delta * meteor.spin.y;
    meteor.body.rotation.z += delta * meteor.spin.z;
    meteor.glow.material.rotation += delta * 0.18;
    meteor.glow.material.opacity = 0.38 + Math.sin(clock.elapsedTime * 4 + index) * 0.08;

    if (meteor.group.position.x < -34 || meteor.group.position.y < -18 || meteor.group.position.z < -20 || meteor.group.position.z > 8) {
      scene.remove(meteor.group);
      meteor.body.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            for (const material of child.material) {
              material.dispose();
            }
          } else {
            child.material.dispose();
          }
        }
      });
      (meteor.glow.material as THREE.Material).dispose();
      (meteor.trail.geometry as THREE.BufferGeometry).dispose();
      (meteor.trail.material as THREE.Material).dispose();
      const labelMaterial = meteor.group.children[3] as THREE.Sprite;
      labelMaterial.material.map?.dispose();
      labelMaterial.material.dispose();
      activeMeteors.splice(index, 1);
    }
  }
}

function updateSceneTheme(progress: number) {
  phaseColorA.copy(bgTopColor).lerp(sunTopColor, progress);
  topMixColor.copy(phaseColorA).lerp(earthTopColor, earthProgress);
  phaseColorA.copy(bgBottomColor).lerp(sunBottomColor, progress);
  bottomMixColor.copy(phaseColorA).lerp(earthBottomColor, earthProgress);
  phaseColorA.copy(fogStart).lerp(fogEnd, progress);
  fogMixColor.copy(phaseColorA).lerp(fogEarth, earthProgress);
  phaseColorA.copy(volumeBorderStart).lerp(volumeBorderEnd, progress);
  volumeBorderMixColor.copy(phaseColorA).lerp(volumeBorderEarth, earthProgress);
  phaseColorA.copy(volumeTopStart).lerp(volumeTopEnd, progress);
  volumeTopMixColor.copy(phaseColorA).lerp(volumeTopEarth, earthProgress);
  phaseColorA.copy(volumeBottomStart).lerp(volumeBottomEnd, progress);
  volumeBottomMixColor.copy(phaseColorA).lerp(volumeBottomEarth, earthProgress);
  phaseColorA.copy(volumeGlowStart).lerp(volumeGlowEnd, progress);
  volumeGlowMixColor.copy(phaseColorA).lerp(volumeGlowEarth, earthProgress);
  phaseColorA.copy(volumeBaseStart).lerp(volumeBaseEnd, progress);
  volumeBaseMixColor.copy(phaseColorA).lerp(volumeBaseEarth, earthProgress);
  phaseColorA.copy(volumeLabelStart).lerp(volumeLabelEnd, progress);
  volumeLabelMixColor.copy(phaseColorA).lerp(volumeLabelEarth, earthProgress);
  phaseColorA.copy(volumeAccentStart).lerp(volumeAccentEnd, progress);
  volumeAccentMixColor.copy(phaseColorA).lerp(volumeAccentEarth, earthProgress);
  panelBorderMixColor.copy(panelBorderStart).lerp(panelBorderEarth, earthProgress);
  panelGlowMixColor.copy(panelGlowStart).lerp(panelGlowEarth, earthProgress);
  panelTopMixColor.copy(panelTopStart).lerp(panelTopEarth, earthProgress);
  panelBottomMixColor.copy(panelBottomStart).lerp(panelBottomEarth, earthProgress);
  buttonBorderMixColor.copy(buttonBorderStart).lerp(buttonBorderEarth, earthProgress);
  buttonGlowMixColor.copy(buttonGlowStart).lerp(buttonGlowEarth, earthProgress);
  buttonTopMixColor.copy(buttonTopStart).lerp(buttonTopEarth, earthProgress);
  buttonBottomMixColor.copy(buttonBottomStart).lerp(buttonBottomEarth, earthProgress);
  buttonTextMixColor.copy(buttonTextStart).lerp(buttonTextEarth, earthProgress);

  document.documentElement.style.setProperty('--bg-top', `#${topMixColor.getHexString()}`);
  document.documentElement.style.setProperty('--bg-bottom', `#${bottomMixColor.getHexString()}`);
  document.documentElement.style.setProperty('--volume-border', `${volumeBorderMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--volume-top', `${volumeTopMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--volume-bottom', `${volumeBottomMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--volume-glow', `${volumeGlowMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--volume-base', `${volumeBaseMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--volume-label', `${volumeLabelMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--volume-accent', `#${volumeAccentMixColor.getHexString()}`);
  document.documentElement.style.setProperty('--panel-border', `${panelBorderMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--panel-glow', `${panelGlowMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--panel-top', `${panelTopMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--panel-bottom', `${panelBottomMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--shift-button-border', `${buttonBorderMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--shift-button-glow', `${buttonGlowMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--shift-button-top', `${buttonTopMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--shift-button-bottom', `${buttonBottomMixColor.getStyle()}`);
  document.documentElement.style.setProperty('--shift-button-text', `${buttonTextMixColor.getStyle()}`);
  sceneFog.color.copy(fogMixColor);
  sceneFog.density = THREE.MathUtils.lerp(0.014, 0.02, progress) - earthProgress * 0.004;
}

const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.028);
  earthProgress = THREE.MathUtils.lerp(earthProgress, targetEarthProgress, delta * 1.2);
  const compositeProgress = sceneProgress + earthProgress * 0.4;
  const speedPulse = THREE.MathUtils.lerp(0.16, 0.1, compositeProgress);
  sceneProgress = THREE.MathUtils.lerp(sceneProgress, targetSceneProgress, delta * 1.8);
  updateSceneTheme(sceneProgress);

  for (const layer of starLayers) {
    const { positions, speed, resetZ, frontZ, spread, radialPush, spawnRadius, boundsX, boundsY, mesh, baseColor, warmColor } = layer;
    const travelSpeed = THREE.MathUtils.lerp(speed, speed * 0.62, compositeProgress);
    const travelPush = THREE.MathUtils.lerp(radialPush, radialPush * 0.64, compositeProgress);
    tempColor.copy(baseColor).lerp(warmColor, sceneProgress);
    tempColor.lerp(new THREE.Color('#a6ddff'), earthProgress * 0.7);
    mesh.material.color.copy(tempColor);

    for (let i = 0; i < positions.length; i += 3) {
      const depthProgress = (positions[i + 2] - resetZ) / (frontZ - resetZ);
      const outwardForce = (0.08 + depthProgress * depthProgress * 0.4) * travelPush * speedPulse;
      positions[i] += positions[i] * outwardForce * delta * 2.2;
      positions[i + 1] += positions[i + 1] * outwardForce * delta * 2.2;
      positions[i + 2] += travelSpeed * speedPulse * (delta * 60);

      if (positions[i + 2] > frontZ || Math.abs(positions[i]) > boundsX || Math.abs(positions[i + 1]) > boundsY) {
        respawnPoint(positions, i, spread, resetZ, spawnRadius);
      }
    }

    mesh.geometry.attributes.position.needsUpdate = true;
  }

  for (const layer of streakLayers) {
    const { positions, speed, resetZ, frontZ, spread, tail, radialPush, spawnRadius, boundsX, boundsY, mesh, baseColor, warmColor } = layer;
    const travelSpeed = THREE.MathUtils.lerp(speed, speed * 0.66, sceneProgress);
    const travelPush = THREE.MathUtils.lerp(radialPush, radialPush * 0.68, sceneProgress);
    const tailLength = THREE.MathUtils.lerp(tail, tail * 1.7, sceneProgress);
    tempColor.copy(baseColor).lerp(warmColor, sceneProgress);
    mesh.material.color.copy(tempColor);
    const streakFade = 1 - THREE.MathUtils.smoothstep(sceneProgress, 0.015, 0.085);
    mesh.material.opacity = 0.68 * streakFade;
    mesh.visible = streakFade > 0.015;

    if (!mesh.visible) {
      continue;
    }

    for (let i = 0; i < positions.length; i += 6) {
      const depthProgress = (positions[i + 2] - resetZ) / (frontZ - resetZ);
      const outwardForce = (0.12 + depthProgress * depthProgress * 0.55) * travelPush * speedPulse;
      positions[i] += positions[i] * outwardForce * delta * 2.4;
      positions[i + 1] += positions[i + 1] * outwardForce * delta * 2.4;
      positions[i + 2] += travelSpeed * speedPulse * (delta * 60);
      positions[i + 3] = positions[i];
      positions[i + 4] = positions[i + 1];
      positions[i + 5] = positions[i + 2] - tailLength;

      if (positions[i + 2] > frontZ || Math.abs(positions[i]) > boundsX || Math.abs(positions[i + 1]) > boundsY) {
        const x = (Math.random() - 0.5) * spread * spawnRadius;
        const y = (Math.random() - 0.5) * spread * 0.58 * spawnRadius;
        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = resetZ;
        positions[i + 3] = x;
        positions[i + 4] = y;
        positions[i + 5] = resetZ - tailLength;
      }
    }

    mesh.geometry.attributes.position.needsUpdate = true;
  }

  const sunPulse = 1 + Math.sin(clock.elapsedTime * 1.2) * 0.015;
  const arrivalScale = THREE.MathUtils.lerp(0.42, 1.08, sceneProgress) * sunPulse;
  sunGroup.position.z = THREE.MathUtils.lerp(-85, -26, sceneProgress);
  sunGroup.position.x = 0;
  sunGroup.position.y = THREE.MathUtils.lerp(-0.2, 0, sceneProgress);
  sun.position.set(0, 0, 0);
  sunCorona.position.copy(sun.position);
  sunGlow.position.copy(sun.position);
  sunOuterGlow.position.copy(sun.position);
  sun.scale.setScalar(arrivalScale);
  sunCorona.scale.setScalar(arrivalScale * 1.14);
  sunGlow.scale.setScalar(THREE.MathUtils.lerp(38, 98, sceneProgress));
  sunOuterGlow.scale.setScalar(THREE.MathUtils.lerp(54, 144, sceneProgress));
  (sun.material as THREE.MeshBasicMaterial).opacity = sceneProgress * 0.96;
  (sunCorona.material as THREE.MeshBasicMaterial).opacity = sceneProgress * 0.38;
  (sunGlow.material as THREE.SpriteMaterial).opacity = sceneProgress * 0.8;
  (sunOuterGlow.material as THREE.SpriteMaterial).opacity = sceneProgress * 0.45;
  sun.rotation.y += delta * 0.08;
  sunCorona.rotation.y -= delta * 0.05;
  sunGlow.material.rotation += delta * 0.06;
  sunOuterGlow.material.rotation -= delta * 0.04;

  const sunFade = 1 - earthProgress;
  sunGroup.visible = sunFade > 0.01;
  (sun.material as THREE.MeshBasicMaterial).opacity *= sunFade;
  (sunCorona.material as THREE.MeshBasicMaterial).opacity *= sunFade;
  (sunGlow.material as THREE.SpriteMaterial).opacity *= sunFade;
  (sunOuterGlow.material as THREE.SpriteMaterial).opacity *= sunFade;

  earthGroup.visible = earthProgress > 0.01;
  earthGroup.position.z = THREE.MathUtils.lerp(-58, -23, earthProgress);
  earthGroup.position.y = THREE.MathUtils.lerp(0.15, 0.05, earthProgress);
  earthGroup.rotation.z = Math.sin(clock.elapsedTime * 0.08) * 0.012 * earthProgress;
  earthAmbientLight.intensity = earthProgress * 0.78;
  earthKeyLight.intensity = earthProgress * 1.9;
  earthRimLight.intensity = earthProgress * 0.68;
  earthCore.scale.setScalar(THREE.MathUtils.lerp(0.74, 1.08, earthProgress));
  earthClouds.scale.setScalar(THREE.MathUtils.lerp(0.76, 1.01, earthProgress));
  earthAtmosphere.scale.setScalar(THREE.MathUtils.lerp(0.8, 1.014, earthProgress));
  earthOuterAtmosphere.scale.setScalar(THREE.MathUtils.lerp(0.82, 1.03, earthProgress));
  earthGlow.scale.setScalar(THREE.MathUtils.lerp(16, 26, earthProgress));
  (earthClouds.material as THREE.MeshPhongMaterial).opacity = earthProgress * 0.3;
  (earthAtmosphere.material as THREE.MeshBasicMaterial).opacity = earthProgress * 0.08;
  (earthOuterAtmosphere.material as THREE.MeshBasicMaterial).opacity = earthProgress * 0.05;
  (earthGlow.material as THREE.SpriteMaterial).opacity = earthProgress * 0.04;
  earthCore.rotation.y += delta * 0.08;
  earthClouds.rotation.y += delta * 0.11;
  earthAtmosphere.rotation.y += delta * 0.03;
  earthOuterAtmosphere.rotation.y -= delta * 0.015;
  earthGlow.material.rotation -= delta * 0.01;

  updateMeteors(delta);
  camera.lookAt(0, 0, THREE.MathUtils.lerp(-120, -32, sceneProgress + earthProgress * 0.16));
  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

loadRegions();
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
});
