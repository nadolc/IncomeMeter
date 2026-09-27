# 唔使 Mac、唔使 Apple Developer 帳戶：用 SideStore 裝 IncomeMeter

用免費 Apple ID 將 IncomeMeter 裝落 iPhone，包括背景 GPS 記錄。SideStore 會喺背景自動續期，免費簽署每 7 日到期嗰個限制，平時唔使理。

> 以下 SideStore 步驟根據佢嘅官方文件（2026 年 9 月）。SideStore 係第三方開源工具，iOS 更新後有機會要等佢更新。遇到問題以 [docs.sidestore.io](https://docs.sidestore.io/) 為準。

## 你需要

- iPhone，iOS 15 或以上，有設密碼
- 64 位元 Windows 電腦（一次性設定用）同 USB 線
- 免費 Apple ID
- Wi‑Fi（SideStore 官方寫明設定時要用 Wi‑Fi，唔可以用流動數據）

## 1. 下載 IncomeMeter.ipa

1. 去 GitHub repo → **Actions** → 左邊揀 **iOS unsigned IPA** → **Run workflow**。
2. 等大約 20–30 分鐘跑完（綠色 ✓）。
3. 撳入嗰次 run，喺 **Artifacts** 下載 **IncomeMeter-ipa**，解壓得到 `IncomeMeter.ipa`。
4. 將個檔放入 iCloud Drive（或者用 AirDrop），等 iPhone「檔案」app 睇到。

App 有更新時，重新做一次呢步就得。

## 2. 裝 SideStore（只做一次）

跟官方 [安裝教學](https://docs.sidestore.io/docs/installation/install)，大概係：

1. Windows 裝 iTunes 同 **iloader**（[所需工具](https://docs.sidestore.io/docs/installation/prerequisites)）。
2. iPhone 喺 App Store 裝 **LocalDevVPN**。
3. USB 接駁 iPhone，打開 iloader，用你嘅 Apple ID 登入，揀 **Install SideStore (Stable)**。
4. iPhone：設定 → 一般 → VPN 與裝置管理 → 信任你嘅 Apple ID。
5. iPhone：設定 → 私隱與保安 → 開啟 **開發者模式**（部機會重新開機）。
6. 打開 LocalDevVPN → Connect。
7. 打開 SideStore，用同一個 Apple ID 登入，喺 My Apps 撳 SideStore 旁邊嘅「7 DAYS」完成設定。

## 3. 裝 IncomeMeter

1. 打開 LocalDevVPN，確認已連接。
2. SideStore → **My Apps** → 左上角 **＋** → 喺「檔案」揀 `IncomeMeter.ipa`。
3. 裝好之後打開 IncomeMeter。定位權限揀「使用 App 時」，開始第一條路線時再揀「一律允許」，背景 GPS 先會記錄。
4. 設定 → 伺服器地址填 `https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net`，再用 Google 登入。

## 4. 續期

- SideStore 會定期喺背景幫 app 續期。續期時 **LocalDevVPN 要開住**。
- 喺 SideStore → My Apps 睇到仲有幾多日。少過 2 日就打開 LocalDevVPN，再撳嗰個日數手動續期，一秒完成。
- 萬一過咗期，app 會開唔到，但**資料唔會唔見**。續期之後打開，資料照舊。

## 限制

- 免費 Apple ID 同一時間最多裝 3 個自己簽嘅 app，SideStore 本身佔 1 個；每星期最多裝 10 個唔同 app。
- 用 SideStore 裝嘅 app 冇 App Store 自動更新；有新版就重做第 1 步，再喺 SideStore 裝，資料會保留。
- 想唔使理續期，就要開 Apple Developer（每年 US$99），改用 TestFlight（見 README）。
