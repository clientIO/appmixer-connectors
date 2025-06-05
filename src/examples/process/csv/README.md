# About
Connectors and components in this directory are used to process large CSV files.

## ProcessLargeCSV1
This example demonstrates how to process a large CSV file using the `ProcessLargeCSV1` component. It reads the CSV file in chunks, processes each chunk, and outputs the results.

Features:
- safely processes large CSV files chunking the original Appmixer stream into smaller chunks
- the final read stream is `csv-reader` which reads the CSV file and emits each row as a JSON object
- custom logic is implemented and hardcoded in the component to transform data into the desired format
- the file is then written to a new CSV file using Appmixer streams again

Example run 1) on Appmixer engine pod:
- 100000 rows in the original CSV file
- ~150000 rows in the final CSV file
- up to 1 second processing time

Example run 2) on Appmixer engine pod:
- 1505101 rows in the original CSV file, 90MB in size
- 1884146 rows in the final CSV file
- 2025-06-04T20:09:44.793Z started processing
- 2025-06-04T20:10:21.556Z finished processing

Not included in the example:
- no timeouts are set, so the process will run until completion
- no retry logic is implemented, so if the process fails, it will not retry
- customizable options for the `csv-reader` stream are not included, but can be added as needed. See for example the `appmixer.utils.csv.AddRows` or `appmixer.utils.csv.GetRows` components for more details.

## CSV ETL
This example demonstrates how to process a large CSV file using the `CSV ETL` component. It reads the CSV file row by row, transforms the data using a `dtl-js` transform object, and outputs the results. See https://getdtl.org/.

This is very similar to `ProcessLargeCSV1`, but uses `dtl-js` to transform the data instead of hardcoded logic in the component. This allows for more flexibility and reusability of the transformation logic. No custom logic is implemented in the component javascript code.

Example run 2) on Appmixer engine pod:
- 1505101 rows in the original CSV file, 90MB in size
- 1884146 rows in the final CSV file
- 2025-06-04T20:09:44.937Z started processing
- 2025-06-04T20:10:27.208Z finished processing (slightly longer than `ProcessLargeCSV1` due to the transformation logic)

Known issues:
- in order to add newline characters to the CSV file, you can't use "\n" in the `dtl-js` transform object, but rather use the `\n` character directly (press Enter in the `tranformation` field in the UI). By default the component adds a newline character to the end of each row, so you don't need to add it manually.
- currently the component uses only the default transform `out` and only supports a string as its value.

### Transformation example
CSV file:
```
s1,Movie,The Grand Seduction,Don McKellar,"Brendan Gleeson, Taylor Kitsch, Gordon Pinsent",Canada,"March 30, 2021",2014,,113 min
s2,Movie,Take Care Good Night,Girish Joshi,"Mahesh Manjrekar, Abhay Mahajan, Sachin Khedekar",India,"March 30, 2021",2018,13+,110 min
s3,Movie,Secrets of Deception,Josh Webber,"Tom Sizemore, Lorenzo Lamas, Robert LaSardo, Richard Jones, Yancey Arias, Noel Gugliemi",United States,"March 30, 2021",2017,,74 min
s4,Movie,Pink: Staying True,Sonia Anderson,"Interviews with: Pink, Adele, Beyoncé, Britney Spears, Christina Aguilera, more!",United States,"March 30, 2021",2014,,69 min
s5,Movie,Monster Maker,Giles Foster,"Harry Dean Stanton, Kieran O'Brien, George Costigan, Amanda Dickinson, Alison Steadman, Grant Bardsley, Bill Moody, Matthew Scurfield",United Kingdom,"March 30, 2021",1989,,45 min
s6,Movie,Living With Dinosaurs,Paul Weiland,"Gregory Chisholm, Juliet Stevenson, Brian Henson, Michael Maloney",United Kingdom,"March 30, 2021",1989,,52 min
s7,Movie,Hired Gun,Fran Strine,"Alice Cooper, Liberty DeVitto, Ray Parker Jr., David Foster, Jason Hook, Steve Vai, Phil X, Rudy Sarzo, Jay Graydon, Rob Zombie, Kenny Aronoff, Steve Lukather, Justin Derrico, Eva Gardner, John 5, Eric Singer, Derek St. Holmes, Paul Bushnell, Jason Newsted, Glen Sobel, Nita Strauss, Chris Johnson",United States,"March 30, 2021",2017,,98 min
s8,Movie,Grease Live!,"Thomas Kail, Alex Rudzinski","Julianne Hough, Aaron Tveit, Vanessa Hudgens, Keke Palmer, Carly Rae Jepson, Mario Lopez, Carlos PenaVega, Kether Donohue, Jordan Fisher, David Del Rio, Andrew Call, Wendell Pierce, Boyz II Men, Jessie J, Ana Gasteyer, Didi Conn",United States,"March 30, 2021",2016,,131 min
s9,Movie,Global Meltdown,Daniel Gilboy,"Michael Paré, Leanne Khol Young, Patrick J. MacEachern",Canada,"March 30, 2021",2017,,87 min
s10,Movie,David's Mother,Robert Allan Ackerman,"Kirstie Alley, Sam Waterston, Stockard Channing",United States,"April 1, 2021",1994,,92 min
```

Transformation object:
```
(: &( &(60 * num($.[9]), ' sec,'), join($.) ) :)
```

This transformation takes the last column (duration) of each row, converts it to seconds, and prepends it to the rest of the row, separated by a comma. The result is a new CSV file with the duration in seconds as the first column.

Transformed CSV file:
```
6780 sec,s1,Movie,The Grand Seduction,Don McKellar,Brendan Gleeson, Taylor Kitsch, Gordon Pinsent,Canada,March 30, 2021,2014,,113 min
6600 sec,s2,Movie,Take Care Good Night,Girish Joshi,Mahesh Manjrekar, Abhay Mahajan, Sachin Khedekar,India,March 30, 2021,2018,13+,110 min
4440 sec,s3,Movie,Secrets of Deception,Josh Webber,Tom Sizemore, Lorenzo Lamas, Robert LaSardo, Richard Jones, Yancey Arias, Noel Gugliemi,United States,March 30, 2021,2017,,74 min
4140 sec,s4,Movie,Pink: Staying True,Sonia Anderson,Interviews with: Pink, Adele, Beyoncé, Britney Spears, Christina Aguilera, more!,United States,March 30, 2021,2014,,69 min
2700 sec,s5,Movie,Monster Maker,Giles Foster,Harry Dean Stanton, Kieran O'Brien, George Costigan, Amanda Dickinson, Alison Steadman, Grant Bardsley, Bill Moody, Matthew Scurfield,United Kingdom,March 30, 2021,1989,,45 min
3120 sec,s6,Movie,Living With Dinosaurs,Paul Weiland,Gregory Chisholm, Juliet Stevenson, Brian Henson, Michael Maloney,United Kingdom,March 30, 2021,1989,,52 min
5880 sec,s7,Movie,Hired Gun,Fran Strine,Alice Cooper, Liberty DeVitto, Ray Parker Jr., David Foster, Jason Hook, Steve Vai, Phil X, Rudy Sarzo, Jay Graydon, Rob Zombie, Kenny Aronoff, Steve Lukather, Justin Derrico, Eva Gardner, John 5, Eric Singer, Derek St. Holmes, Paul Bushnell, Jason Newsted, Glen Sobel, Nita Strauss, Chris Johnson,United States,March 30, 2021,2017,,98 min
7860 sec,s8,Movie,Grease Live!,Thomas Kail, Alex Rudzinski,Julianne Hough, Aaron Tveit, Vanessa Hudgens, Keke Palmer, Carly Rae Jepson, Mario Lopez, Carlos PenaVega, Kether Donohue, Jordan Fisher, David Del Rio, Andrew Call, Wendell Pierce, Boyz II Men, Jessie J, Ana Gasteyer, Didi Conn,United States,March 30, 2021,2016,,131 min
5220 sec,s9,Movie,Global Meltdown,Daniel Gilboy,Michael Paré, Leanne Khol Young, Patrick J. MacEachern,Canada,March 30, 2021,2017,,87 min
5520 sec,s10,Movie,David's Mother,Robert Allan Ackerman,Kirstie Alley, Sam Waterston, Stockard Channing,United States,April 1, 2021,1994,,92 min
```
