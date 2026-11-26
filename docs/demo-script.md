# GroundTruth demo video: script and shot list

Target length: about 7 minutes 30 seconds. Live site: https://ground-truth-tawny.vercel.app

## Before you record

1. Within 10 minutes of recording, open each of these once and wait for every section to load, so they open quickly on camera:
   - Allapur: https://ground-truth-tawny.vercel.app/analyze?lat=17.4612&lng=78.4149&q=Allapur%2C+Hyderabad
   - Dharampeth: https://ground-truth-tawny.vercel.app/analyze?lat=21.14&lng=79.065&q=Dharampeth%2C+Nagpur
2. Check that the numbers quoted below match your screen. If one differs, say what the screen says.
3. Browser: full screen, 100% zoom, dark theme, bookmarks bar hidden, notifications off.
4. Keep the links in separate tabs, plus one tab on the home page.
5. If a section says "This part could not load", press **Try again** and cut it from the video.

## Script

### 1. The problem (0:00 to 0:50)

**Show:** home page.

**Say:**
> "Buying a home is the biggest purchase most families make. In many Indian cities, some plots that look like ordinary land today were lakes, tanks or wetlands twenty or thirty years ago. Land like that can flood, and it can carry legal trouble. A buyer standing at the site cannot see any of this, and usually has only the seller's word.
>
> GroundTruth answers one question: what was this land before you buy it?"

### 2. Starting a check (0:50 to 1:30)

**Show:** type "Allapur, Hyderabad" in the search box without pressing Enter. Point at **Use my current location** and **Drop a pin on the map**. Scroll to the examples, then switch to the Allapur tab.

**Say:**
> "You can search an address, paste coordinates, use your phone's location at the site, or drop a pin. GroundTruth then studies a circle of 150 metres around that point, using satellite records through Google Earth Engine. A new place takes a little while, and each result appears as it is ready. I opened this one earlier."

### 3. The answer first (1:30 to 2:20)

**Show:** the top of the Allapur page. Point at the risk word, the one-line reason and the score. Zoom the map in and out once. Press **Show water record**, pause, then hide it.

**Say:**
> "The answer comes first: High risk, 73 out of 100, with the reason in one sentence. The band is shown as a word and a shape, so it does not depend on colour.
>
> This is the plot today, with road and place names. The white circle is the area being checked. This blue layer is where satellites have seen water since 1984."

### 4. See it change (2:20 to 3:40)

**Show:** scroll to **Then and now**. Press **2014 · sharp** and drag the slider slowly both ways. Press **2022 · sharp** and drag again. Press **1999 · satellite**. Open **Time-lapse** and press **Play**.

**Say:**
> "Evidence matters more than a score. Here is the same ground in earlier years against today, in sharp archive pictures.
>
> Going back to 1999 the picture is much softer. That is the real limit of the satellites of that time. The dark area is water and thick growth. We show it as it is and do not sharpen it into something it never recorded.
>
> The time-lapse plays one picture a year."

### 5. When did it change? (3:40 to 4:40)

**Show:** **When it changed**. Read the large sentence. Hover a few bars. Point at a striped year. Open **Sources and the data table** briefly.

**Say:**
> "For each year, a model sorts the land into water, plants, bare or filled ground, and buildings. Here the images suggest water until about 2008, then plants growing over it, and buildings from about 2013.
>
> The tool reads the plant stage as a natural change and says so. It does not claim someone filled this land when the pictures cannot show that. Either way, this ground held water within recent memory and has buildings on it now.
>
> Striped years had no clear image, mostly because of cloud. We leave them empty. We never guess."

### 6. Water, height and the reasons (4:40 to 5:40)

**Show:** **How often it was water**, then **How low it sits**, then **How the score is built**.

**Say:**
> "A separate long-term water map from the European Commission's research centre and Google shows water here in 23 of the 34 years it could observe.
>
> Height matters for flooding. This zone sits about 4.4 metres below the land around it, so water drains toward it.
>
> The score is not a black box. Six factors add up to 100: past water, how permanent it was, how recently it was filled, distance to water today, ground height, and recent seasonal flooding. Each shows its points and its reason. A score of 55 or more is High, and under 25 is Low."

### 7. What to do next, and the report (5:40 to 6:20)

**Show:** **In plain words**, then **What to check next**. Press **Open report**, scroll once, then open the print preview and close it.

**Say:**
> "There is a short summary in plain language, and the three checks to make next: land and revenue records, the water-body boundary map, and a title search by a lawyer. The report has its own link and prints as a clean document you can send to family, a lawyer or a bank."

### 8. Does it just say "High" to everything? (6:20 to 6:50)

**Show:** the Dharampeth tab: the verdict and the water headline.

**Say:**
> "This is a control site in Nagpur that was never water in the satellite record. It scores Low. We test the app against places like this, so we know it can say no."

### 9. How it works, and its limits (6:50 to 7:30)

**Show:** **About this check** at the bottom of the Allapur page.

**Say:**
> "Under the hood: Landsat and Sentinel-2 satellite images, a long-term water map and an elevation model, all processed in Google Earth Engine. The land classifier is a Random Forest. On two cities it never trained on, Kolkata and Guwahati, it agreed with Google's Dynamic World land maps 92.5 percent of the time on a balanced test set. That is agreement with another map, not a survey on the ground.
>
> So the limits are clear. This is a screening tool, not a legal opinion. It describes a zone, not a single building, and it cannot see lakes filled before 1984.
>
> GroundTruth: know what your land was before you buy it."

## Likely questions

| Question | Short answer |
| --- | --- |
| How accurate is it? | 92.5% agreement with Dynamic World on two held-out cities, against 71.1% for a tuned rule-based method. Not verified on the ground. |
| Is the summary written by AI? | On the live site it is built from a fixed template using the computed facts. AI writing is an option that needs an API key, and it has not been tried with a real key. |
| Why is the old picture blurry? | Satellites then recorded 15 to 30 metres per pixel. Sharp archive pictures start in 2014. |
| What does the archive year mean? | The year Esri published that archive. The photo may be older. |
| Can it prove a plot was a lake? | No. It shows what satellites recorded and tells you which official records to check. |
| What does it cost to run? | It uses a noncommercial Earth Engine account, which has usage limits. Heavy use would need a paid plan. |

## Words to avoid on camera

- "This land was a lake." Say "the satellite record shows water here".
- "Safe" for a Low result. Say "no water found in the satellite record".
- "92.5% accurate" on its own. Always add "agreement with Dynamic World".
