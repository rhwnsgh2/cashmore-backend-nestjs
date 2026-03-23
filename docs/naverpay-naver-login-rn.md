# 네이버 로그인 연동 가이드 (React Native)

네이버페이 포인트 전환을 위해 앱에서 네이버 로그인을 연동하는 방법.

## 라이브러리

- **패키지**: `@react-native-seoul/naver-login`
- **GitHub**: https://github.com/crossplatformkorea/react-native-naver-login
- **npm**: https://www.npmjs.com/package/@react-native-seoul/naver-login

## 로그인 → uniqueId 획득 흐름

```
1. NaverLogin.initialize({ consumerKey, consumerSecret, appName, serviceUrlSchemeIOS })
2. NaverLogin.login() → accessToken 획득
3. NaverLogin.getProfile(accessToken) → response.id가 uniqueId
4. 백엔드에 POST /naverpay/connect { uniqueId: response.id } 호출
```

- `response.id`가 네이버 사용자 고유 식별자(uniqueId)
- 이 값을 백엔드 `POST /naverpay/connect`에 전달하면 다우기술을 통해 네이버페이 계정 연결이 진행됨

## 플랫폼별 설정

### iOS

- `cd ios && pod install`
- Info.plist에 `LSApplicationQueriesSchemes` 추가: `naversearchapp`, `naversearchthirdlogin`
- Info.plist에 `CFBundleURLTypes`로 커스텀 URL Scheme 등록
- `disableNaverAppAuthIOS` 옵션으로 웹뷰 로그인 강제 가능

### Android

- Auto Linking 적용 (별도 linking 불필요)
- ProGuard(R8) 사용 시 규칙 추가 필요

### 공통

- 네이버 개발자 센터(https://developers.naver.com)에서 `consumerKey`, `consumerSecret` 발급 필요

## 참고

- 네이버 로그인 API 명세: https://developers.naver.com/docs/login/api/api.md
- 프로필 조회 API: https://developers.naver.com/docs/login/profile/profile.md
- 프로필 조회 엔드포인트: `GET https://openapi.naver.com/v1/nid/me`
