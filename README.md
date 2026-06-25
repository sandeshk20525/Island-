# LSPosed Module Gateway Setup (com.android.systemui)

Aapka LSPosed Module gateway boilerplate ready hai! Is boilerplate ke saath, aap `com.android.systemui` ke andarr koi bhi method hook kar sakte hain.

## GitHub Actions Automated Build Setup:
Is project boilerplate ke andar complete **GitHub Actions CI/CD Workflow** configure kiya gaya hai! GitHub repo par push karte hi automatic cloud pe APK generate ho jayega.

1. Download kiye gaye project folder ko apne local system pe extract karein.
2. GitHub par ek naya **Public** ya **Private** Repository banayein.
3. Apne local folder mein Git command terminal kholein aur ye steps run karein:
   ```bash
   git init
   git add .
   git commit -m "feat: setup LSPosed Hybrid Module with GitHub Actions CI/CD"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
4. GitHub repository ke **Actions** tab par jayein!
5. GitHub Actions automatic runner active ho jayega aur Gradle compiler call karke APK build complete kar dega.
6. Build successfully end hone par workflow run ke niche artifacts panel se compiled APK download kar sakte hain!

## Local setup aur Manual Android Studio build:

1. **Android Studio Project**: Naya project banayein jisme Kotlin build script (`build.gradle.kts`) ho.
2. **File Paths**:
   - `AndroidManifest.xml` ko replace karein ya usme `<meta-data>` tags add karein.
   - `app/src/main/assets/` directory banayein aur uske andar `xposed_init` naam ki blank file (bina extension ke) banayein. Us file ke andar sirf ye single line daalein:
     ```text
     com.android.island.IslandHook
     ```
   - Kotlin files ko unke specific package path (`app/src/main/java/com/android/island/`) par paste karein.
3. **Gradle setup**:
   - `build.gradle.kts` ke dependencies block mein `compileOnly("de.robv.android.xposed:api:82")` add karein.
   
## Testing aur Debugging kaise karein:

1. **APK Build karein**: Android Studio mein debug APK build karein (`./gradlew assembleDebug`).
2. **Install karein**: Phone ya emulator par APK install karein jispe Magisk/Kitsune aur **LSPosed Manager** configured ho.
3. **Module Activate karein**:
   - LSPosed Manager app kholein.
   - 'Modules' tab mein jaake apne module (`Island Module`) ko toggle on (enable) karein.
   - **SystemUI** package ko checkmark karein (LSPosed auto-recommend karega is package ko recommended list ke according).
4. **Reboot**: Status bar hooks ko update karne ke liye ya to SystemUI process ko kill/restart karein (`adb shell pkill com.android.systemui`) ya fir device reboot karein.
5. **Log check karein**:
   - Tool logcat command run karein:
     ```bash
     adb logcat -s Island-Log
     ```
   - LSPosed Manager ke Log panel mein jaake module log check karein.
