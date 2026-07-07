export abstract class BaseHandler<TPayload = any, TResult = any> {
  /**
   * The job type this handler processes.
   */
  abstract readonly type: string;

  /**
   * Validates the job payload.
   * Throws ZodError or other validation errors if invalid.
   */
  abstract validate(payload: TPayload): void | Promise<void>;

  /**
   * Executes the task business logic.
   * Emits progress percentage via the provided progress callback.
   */
  abstract execute(
    payload: TPayload,
    progress: (percent: number) => Promise<void>
  ): Promise<TResult>;

  /**
   * Optional rollback method executed if execution or DB state update fails.
   */
  rollback?(payload: TPayload, error: Error): void | Promise<void>;
}
