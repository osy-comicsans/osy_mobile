# Accounts and onboarding

Users must sign in and add both documents before they can reach the tabs. This covers issue #23. Real OCR comes later in #28.

## Flow

1. **Login or Register:** a new account goes to Documents.
2. **Documents:** shows each document's status and the consent notice.
3. **Source:** the user adds the front, then the back, by camera, photo, or file.
4. **Review:** the user corrects the fields, then confirms. Only `previousNumber` is optional.
5. **Upload:** once neither document is `missing` or `rejected`, the app opens the tabs.

A failed upload keeps the document for retry. A rejected one returns to Source with the reason. A user who quits returns to the first missing document.

`src/features/auth/utils/accountService.ts` decides where a user belongs:

| Phase | Can reach |
| --- | --- |
| `signedOut` | Login, Register |
| `onboarding` | Documents, Source, Review |
| `ready` | Tabs |

`check-in` and `alert` stay reachable in every phase, so onboarding never blocks a crash alert. Someone who finished onboarding can still open the app offline.

## Mock backend

With no `EXPO_PUBLIC_API_URL`, development builds use the mock in `src/common/lib/api/mock/`. It sits behind the real API client, so setting the URL is the only change needed to use a real backend.

Release builds use the mock only if `EXPO_PUBLIC_MOCK_API` is `true`. Leave it unset in production, because the mock accepts any document.

| Try | How |
| --- | --- |
| Skip onboarding | Sign in as `demo@osy.test` with any password |
| Already registered | Register with `taken@osy.test` or `+213555000000` |
| Wrong password | Sign in with `Wrong123` |
| Lost connection | Use `offline@osy.test` |
| Rejected document | Put `REJECT` in any document field |

Mock data stays on the device, without passwords or document data. It is not cleared by signing out.

## OCR

Documents are read on the phone with PaddleOCR, so no image or field leaves the device during OCR. The PP-OCRv5 mobile models in `assets/ocr/` add about 21 MB to the app, and ONNX Runtime adds its own native size.

1. `readPage()` finds the lines of text, then reads each one with the Latin and Arabic models.
2. `parseDocument()` uses the licence MRZ, numbered markers, and registration labels to fill the fields.
3. Invalid values stay empty. Those and any unsure values are marked for checking on the Review screen.

OCR needs a development build. Expo Go has no ONNX Runtime, so the app falls back to sample values under the mock, and to manual entry otherwise. Web and PDFs also skip OCR.

Commune, brand, and vehicle tables are not bundled yet, so Arabic-only values stay in Arabic and are marked for checking. A name that differs from the account shows a warning, and does not block onboarding.

Confirmed fields are stored in `documents.db`, encrypted with SQLCipher. The key is in SecureStore. Builds without SQLCipher store nothing.

## Design

The screens follow [DESIGN.md](../DESIGN.md):

| Element | Where | Spec |
| --- | --- | --- |
| Brand gradient hero and sheet | `AuthScreen` | §2, §4 |
| Notched floating label and field states | `Input` | §8 |
| Document steps | `DocumentTracker` | §15 |
| Source choices | `SourceOption` | §11.3 |
| Status pills | `DocumentTracker` | §16 |

The hero has a solid accent fill under its gradient, so its white text stays readable if the gradient is not drawn.

## Before release

- **Consent notice:** it is draft text with no retention period. The real period and legal wording for Algeria are required.
- **Translations:** French and Arabic text is an unreviewed draft.
- **Backend:** it must enforce access and the 10 MB limit, because route guards and file checks run only on the phone.
- **Upload contract:** `file_front`, `file_back`, `consentVersion`, and `consentedAt` need the backend team's agreement.
- **Device checks:** see below.

## Device checks

These have not been run on a device or simulator:

- [ ] A deep link to a tab while signed out, including how the `(tabs)` anchor behaves with the guards
- [ ] Camera, photo, and file capture for both documents
- [ ] Camera permission denied
- [ ] Resume after a real relaunch
- [ ] The Review screen, which has not been seen rendered
- [ ] Arabic layout on a device, especially floating labels
- [ ] Large font sizes
- [ ] OCR on real licences and registration cards, with speed and memory on a phone
- [ ] ONNX Runtime and SQLCipher in a development build

Web renders of Login, Register, Documents, Source, and the validation errors were checked. On web, a signed-out link to `/map` went to Login. Floating labels sit on the wrong side in Arabic on web, because React Native Web does not flip `start` there. This needs checking on a device.

## Not built yet

- Sign-out: there is no screen for it yet, so testing a second account needs a reinstall.
- Password reset: it has no issue yet.
- Document edge detection: "Scan" uses the plain camera.
- Email or mobile verification.
