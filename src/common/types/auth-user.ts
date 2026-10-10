/** What the auth guard attaches to `request.user`. */
export interface AuthUser {
  /** Our user id (uuid). */
  id: string;
  /** Firebase Auth uid. */
  firebaseUid: string;
}
