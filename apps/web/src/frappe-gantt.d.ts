declare module 'frappe-gantt' {
  export type GanttTask = {
    id: string;
    name: string;
    start: string;
    end: string;
    progress?: number;
    dependencies?: string;
    custom_class?: string;
    description?: string;
  };

  export type GanttOptions = {
    view_mode?: 'Day' | 'Week' | 'Month' | 'Year' | string;
    readonly?: boolean;
    readonly_dates?: boolean;
    readonly_progress?: boolean;
    move_dependencies?: boolean;
    view_mode_select?: boolean;
    scroll_to?: 'today' | 'start' | 'end' | string;
    popup?: (context: unknown) => false | string | undefined;
    on_click?: (task: GanttTask) => void;
  };

  export default class Gantt {
    constructor(
      wrapper: string | HTMLElement | SVGElement,
      tasks: GanttTask[],
      options?: GanttOptions,
    );
    change_view_mode(viewMode: string, maintainPosition?: boolean): void;
    update_options(options: Record<string, unknown>): void;
  }
}

declare module 'frappe-gantt/dist/frappe-gantt.css';
