import { Game } from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface GameSection {
    title: string;
    data: Game[];
}

export interface GridPos {
    row: number;
    col: number;
}

interface NavRow {
    sectionIndex: number;
    start: number;
    count: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Controller selection model over the sectioned game grid.
 *
 * The navigable surface is a flat list of rows: each expanded section is
 * chunked into rows of at most `columns` games, so collapsed sections are
 * simply absent and get skipped for free. Selection is stored as a game id
 * (not coordinates), so it survives sort flips and section collapses as
 * long as the game is still visible; movement is clamped with no wrap,
 * matching the original EmuCenter's D-pad behavior.
 */
export function useGridSelection(opts: {
    sections: GameSection[];
    collapsedTitles: ReadonlySet<string>;
    columns?: number;
}) {
    const { sections, collapsedTitles, columns = 6 } = opts;

    const rows = useMemo(() => {
        const out: NavRow[] = [];
        sections.forEach((section, sectionIndex) => {
            if (collapsedTitles.has(section.title)) return;
            for (let start = 0; start < section.data.length; start += columns) {
                out.push({
                    sectionIndex,
                    start,
                    count: Math.min(columns, section.data.length - start),
                });
            }
        });
        return out;
    }, [sections, collapsedTitles, columns]);

    const posById = useMemo(() => {
        const map = new Map<string, GridPos>();
        rows.forEach((row, rowIndex) => {
            for (let col = 0; col < row.count; col++) {
                const game = sections[row.sectionIndex].data[row.start + col];
                map.set(game.id, { row: rowIndex, col });
            }
        });
        return map;
    }, [rows, sections]);

    const [selectedId, setSelectedId] = useState<string | null>(null);

    // A selected game that left the visible model (collapsed away, filtered
    // out, removed) clears the selection rather than jumping elsewhere.
    useEffect(() => {
        if (selectedId && !posById.has(selectedId)) {
            setSelectedId(null);
        }
    }, [selectedId, posById]);

    const gameAt = useCallback((pos: GridPos): Game | null => {
        const row = rows[pos.row];
        if (!row) return null;
        return sections[row.sectionIndex]?.data[row.start + pos.col] ?? null;
    }, [rows, sections]);

    const move = useCallback((dir: Direction) => {
        if (rows.length === 0) {
            setSelectedId(null);
            return;
        }

        const currentPos = selectedId ? posById.get(selectedId) : undefined;
        let next: GridPos;

        if (!currentPos) {
            next = { row: 0, col: 0 };
        } else {
            next = { ...currentPos };
            switch (dir) {
                case 'up':
                    next.row = Math.max(0, currentPos.row - 1);
                    break;
                case 'down':
                    next.row = Math.min(rows.length - 1, currentPos.row + 1);
                    break;
                case 'left':
                    next.col = Math.max(0, currentPos.col - 1);
                    break;
                case 'right':
                    next.col = Math.min(rows[currentPos.row].count - 1, currentPos.col + 1);
                    break;
            }
        }

        // Crossing into a shorter row keeps the column but clamps it.
        next.col = Math.min(next.col, rows[next.row].count - 1);

        const game = gameAt(next);
        setSelectedId(game ? game.id : null);
    }, [rows, posById, selectedId, gameAt]);

    const clear = useCallback(() => setSelectedId(null), []);

    const selectedPos = selectedId ? posById.get(selectedId) ?? null : null;
    const selectedGame = selectedPos ? gameAt(selectedPos) : null;
    const selectedSectionIndex = selectedPos ? rows[selectedPos.row].sectionIndex : null;

    return { selectedId, selectedGame, selectedSectionIndex, move, clear };
}
