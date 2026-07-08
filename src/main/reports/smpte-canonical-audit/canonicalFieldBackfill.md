# Canonical field backfill — passes 1-3

> Generated: 2026-07-08T00:35:38.133Z
> Mode: **APPLY**

| pass | field | changes |
|---|---|---:|
| 0 | publicationDate year (5 approved digit-error fixes) | 5 |
| 1 | publicationDate month (Jan-1 placeholder → canonical month) | 2378 |
| 2 | journalTitle (era-accurate, journal-kind) | 21905 |
| 3a | abstract (canonical-only fill) | 462 |
| 3b | keywords (canonical-only fill) | 305 |
| 4 | authors (same-count name fixes; written under --apply-authors) | 60 |

## Samples (first 25 per pass)

### pubYear

| docId | old | new |
|---|---|---|
| `10.5594-J05436` | "1932-11-01" | "1935-01-01" |
| `10.5594-J15292` | "1992-05-01" | "1995-05-01" |
| `10.5594-J17253` | "1992-05-01" | "1995-06-01" |
| `10.5594-J18005` | "1930-02-01" | "1918-04-01" |
| `10.5594-M00395` | "2015-10-19" | "2005-11-01" |

### pubMonth

| docId | old | new |
|---|---|---|
| `10.5594-J00076C1` | "1990-01-01" | "1990-02-01" |
| `10.5594-J00076iiA` | "1990-01-01" | "1990-02-01" |
| `10.5594-J00076iiiiA` | "1990-01-01" | "1990-02-01" |
| `10.5594-J00076iiiiiiA` | "1990-01-01" | "1990-02-01" |
| `10.5594-J00093801801A` | "1990-01-01" | "1990-10-01" |
| `10.5594-J00093C1` | "1990-01-01" | "1990-10-01" |
| `10.5594-J00093iiA` | "1990-01-01" | "1990-10-01" |
| `10.5594-J00194C1` | "1982-01-01" | "1982-11-01" |
| `10.5594-J00194iiA` | "1982-01-01" | "1982-11-01" |
| `10.5594-J00194iiiiA` | "1982-01-01" | "1982-11-01" |
| `10.5594-J00221C1` | "1982-01-01" | "1982-10-01" |
| `10.5594-J00221iiA` | "1982-01-01" | "1982-10-01" |
| `10.5594-J00221iiiiA` | "1982-01-01" | "1982-10-01" |
| `10.5594-J00244C1` | "1982-01-01" | "1982-09-01" |
| `10.5594-J00244iiA` | "1982-01-01" | "1982-09-01" |
| `10.5594-J00244iiiiA` | "1982-01-01" | "1982-09-01" |
| `10.5594-J00267C1` | "1982-01-01" | "1982-08-01" |
| `10.5594-J00267iiA` | "1982-01-01" | "1982-08-01" |
| `10.5594-J00267iiiiA` | "1982-01-01" | "1982-08-01" |
| `10.5594-J00369C1` | "1981-01-01" | "1981-12-01" |
| `10.5594-J00369iiA` | "1981-01-01" | "1981-12-01" |
| `10.5594-J00369iiiiA` | "1981-01-01" | "1981-12-01" |
| `10.5594-J00390C1` | "1981-01-01" | "1981-11-01" |
| `10.5594-J00390iiA` | "1981-01-01" | "1981-11-01" |
| `10.5594-J00390iiiiA` | "1981-01-01" | "1981-11-01" |

### journalTitle

| docId | old | new |
|---|---|---|
| `10.5594-J00021` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00021C1` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00021iiA` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00021iiiiA` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00022` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00023` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00024` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00025` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00026` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00027` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00028` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00029` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00030` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00031` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00032` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00033` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00034` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00035` | "" | "Journal of the Society of Motion Picture Engineers" |
| `10.5594-J00036` | "" | "Journal of the SMPTE" |
| `10.5594-J00036C1` | "" | "Journal of the SMPTE" |
| `10.5594-J00036iiA` | "" | "Journal of the SMPTE" |
| `10.5594-J00036iiiiA` | "" | "Journal of the SMPTE" |
| `10.5594-J00037` | "" | "Journal of the SMPTE" |
| `10.5594-J00038` | "" | "Journal of the SMPTE" |
| `10.5594-J00039` | "" | "Journal of the SMPTE" |

### abstract

| docId | old | new |
|---|---|---|
| `10.5594-J00802` | "" | "In the past, producers and broadcasters of television programs had few choices  |
| `10.5594-J09471` | "" | "As the hot war of the 40's ended, there was much to be said about the growing u |
| `10.5594-J09686` | "" | "Each year, the SMPTE Progress Report chronicles the technology advances in the  |
| `10.5594-J09687` | "" | "Engineering activities in the SMPTE progressed rapidly in a number of areas: in |
| `10.5594-J09688` | "" | "In my first report as Editorial Director, Motion Pictures, it is my privilege t |
| `10.5594-J09689` | "" | "Poised at the entrance ramp to the information superhighway, it is quite exciti |
| `10.5594-J09690` | "" | "Aaardvark Computer Systems, Inc., introduced the AardDDA, a 1-6 digital distrib |
| `10.5594-J09691` | "" | "On Thursday, September 23, 1993, Sydney was proclaimed the winner in the contes |
| `10.5594-J09692` | "" | "The CBC, along with other industry members, is participating in the Digital Tel |
| `10.5594-J09693` | "" | "Over 300 people attended the 1993 SMPTE Advanced Television and Electronic Imag |
| `10.5594-J09696` | "" | "Members of the Society and Friends: The 135th Technical Conference this past Oc |
| `10.5594-J09697` | "" | "The NASA Johnson Space Center in Houston, Texas, is the lead NASA center for ma |
| `10.5594-J18002` | "" | "In the motion picture industry, as in every other modern industry, the trend in |
| `10.5594-J18008` | "" | "The fact that there are today in operation approximately one thousand motion pi |
| `10.5594-J18035` | "" | "Membership in the Society of Motion Picture Engineers stands for unselfish serv |
| `10.5594-J18053` | "" | "We, in this body, will undoubtedly spend much time and thought on standards, an |
| `10.5594-J18054` | "" | "My reference to Cine-machinery is intended to broadly cover all machinery used  |
| `10.5594-J18055` | "" | "Surprisingly little literature has been written on the subject of condensing le |
| `10.5594-M00096` | "" | "This technical paper is to further explore areas of immediate improvement of th |
| `10.5594-M00099` | "" | "The legacy of humankind is represented by how well we have documented our past  |
| `10.5594-M00100` | "" | "Over the past four to five years there has been a great deal of interest shown  |
| `10.5594-M001001` | "" | "Today we will cover various aspects of Up Conversion for HDTV digital Broadcast |
| `10.5594-M001020` | "" | "Content creators are looking forward to spreading their offer of services, by r |
| `10.5594-M001021` | "" | "The 2009 Analog Shutdown is quickly approaching and television broadcasters hav |
| `10.5594-M001025` | "" | "The cathode ray tube has been a key enabling technology for television since Vl |

### keywords

| docId | old | new |
|---|---|---|
| `10.5594-J07620` | "" | ["Densitometers","Color densitometry"] |
| `10.5594-M001020` | "" | ["Multi-distribution systems","repurposing","computer vision","HMM","BN","DBN"," |
| `10.5594-M001047` | "" | ["MXF","SOA","workflow automation","Application Specification","HD production"] |
| `10.5594-M00105` | "" | ["HDTV","studio","compression","splicing","switching","editing","MPEG","422 prof |
| `10.5594-M001052` | "" | ["MXF","AS-02","AS-03","Application Specifications","IMF","Interoperable Masteri |
| `10.5594-M001053` | "" | ["LTFS","tape","storage","AXF","partitions","partitioning","CRC-check","LTO","T1 |
| `10.5594-M001054` | "" | ["Software applications","media apps","deployment","RIA","web apps","sandboxed a |
| `10.5594-M001055` | "" | ["Autostereoscopic","3D"] |
| `10.5594-M001056` | "" | ["Plasma","plasma reference monitor","plasma evaluation monitor","emissive","tra |
| `10.5594-M001057` | "" | ["Reference Display","Reference Monitor","Broadcast Monitor","color management"] |
| `10.5594-M001058` | "" | ["file-based workflows","quality control","machine-learning","automation"] |
| `10.5594-M001059` | "" | ["file-based workflow","content sources","ingest","editing","file-based sources" |
| `10.5594-M001060` | "" | ["Monitor Calibration","Monitor Alignment","Matching a CRT","BVM","CRT","Plasma" |
| `10.5594-M001062` | "" | ["3D","autostereoscopy","multiview"] |
| `10.5594-M001063` | "" | ["workflow","file based","Media Asset Management"] |
| `10.5594-M001064` | "" | ["UMID","Material Number","Instance Number","UMID Application Principles","UMID  |
| `10.5594-M001065` | "" | ["Digital cinematography","cryptographic hashes","XML signature","data managemen |
| `10.5594-M001068` | "" | ["Media discovery service","reverse image search","image processing","surf","ima |
| `10.5594-M001070` | "" | ["Uncompressed HD video","HD-SDI","3G-SDI","2K","4K","UHDTV","Carrier Ethernet", |
| `10.5594-M001071` | "" | ["SDI","Serial Digital Interface","3Gb/s","3Gbits/s","EBU","3D","2k","4k","SMPTE |
| `10.5594-M001072` | "" | ["Audio","Frequency Response","Time Frequency Analysis","Physiological Acoustics |
| `10.5594-M001073` | "" | ["Multi-channel editing","data management","light field","multi-view","output co |
| `10.5594-M001074` | "" | ["Digital cinema","wide gamut capture","color cameras","color reproduction"] |
| `10.5594-M001075` | "" | ["VDSLR","Post Production","Optimum Image Codec","Digital Enhancement Techniques |
| `10.5594-M001077` | "" | ["22.2 multichannel sound","HRIR","binaural processing","individual variation"," |

### authors

| docId | old | new |
|---|---|---|
| `10.5594-J00465` | [{"affiliation":"22210 Victory Boulevard, Woodland Hills, CA | [{"affiliation":"22210 Victory Boulevard, Woodland Hills, CA 91367.","name":"Wil |
| `10.5594-J00536142142A` | [{"name":"G.R."}] | [{"name":"Gury Rosenberger"}] |
| `10.5594-J00666` | [{"name":"By Richard G. Streeter"}] | [{"name":"Richard G. Streeter"}] |
| `10.5594-J00867` | [{"name":"W. A. Cook"},{"name":"L. A. Jones"}] | [{"name":"Willard B. Cook"},{"name":"L. A. Jones"}] |
| `10.5594-J01003` | [{"name":"Harry R. Lubcke"},{"name":"O.W.R."},{"name":"V.A." | [{"name":"Harry R. Lubcke"}] |
| `10.5594-J01128` | [{"name":"Harry R. Glason"}] | [{"name":"Harry R. Clason"}] |
| `10.5594-J03550` | [{"affiliation":"N. V. Philips, Eindhoven, Netherlands","nam | [{"affiliation":"N. V. Philips, Eindhoven, Netherlands","name":"J. van den Berg" |
| `10.5594-J05045` | [{"name":"A. C. Dowries"}] | [{"name":"A. C. Downes"}] |
| `10.5594-J05083` | [{"affiliation":"Acoustics Corp., 101 Park Ave., New York 17 | [{"name":"James Y. Dunbar","affiliation":"Acoustics Corp., 101 Park Ave., New Yo |
| `10.5594-J05722` | [{"name":"George L. George"},{"name":"A. E. A."}] | [{"name":"George L. George"}] |
| `10.5594-J05731` | [{"affiliation":"DeLuxe General Inc., 1546 N. Argyle Ave., H | [{"affiliation":"DeLuxe General Inc., 1546 N. Argyle Ave., Hollywood, CA 90028." |
| `10.5594-J05746` | [{"affiliation":"Hughes Aircraft Co., El Segundo, Calif.","n | [{"affiliation":"Hughes Aircraft Co., El Segundo, Calif.","name":"C. Caswick"},{ |
| `10.5594-J05852` | [{"affiliation":"Dept. of Mechanics, Illinois Institute of T | [{"affiliation":"Dept. of Mechanics, Illinois Institute of Technology, 3300 S. F |
| `10.5594-J05889` | [{"affiliation":"Research Laboratories, N. V. Philips' Gloei | [{"affiliation":"Research Laboratories, N. V. Philips' Gloeilampenfabrieken, Ein |
| `10.5594-J06198` | [{"affiliation":"Chairman, Subcommittee for Image Assessment | [{"affiliation":"Chairman, Subcommittee for Image Assessment Problems, I.C.O. c/ |
| `10.5594-J06610` | [{"name":"U. L. Mistry"}] | [{"name":"D. L. Mistry"}] |
| `10.5594-J07182` | [{"affiliation":"Walt Disney Productions, 2400 West Alameda  | [{"affiliation":"Walt Disney Productions, 2400 West Alameda Ave., Burbank, Calif |
| `10.5594-J07544` | [{"name":"Yoshi Ohno"}] | [{"name":"John P. Pytlak"},{"name":"Alfred W. Fleischer"}] |
| `10.5594-J07583` | [{"affiliation":"Eastman Kodak Co., Photographic Technology  | [{"affiliation":"Eastman Kodak Co., Photographic Technology Div., Bldg. 69, Koda |
| `10.5594-J08310` | [{"affiliation":"Du Art Film Laboratories. Inc., 245 W. 55 S | [{"affiliation":"Du Art Film Laboratories. Inc., 245 W. 55 St., New York, N.Y. 1 |
| `10.5594-J08599` | [{"affiliation":"Neuilly, Paris, France","name":"Louis Lumiè | [{"affiliation":"Neuilly, Paris, France","name":"Louis Lumiere"}] |
| `10.5594-J08654` | [{"affiliation":"Dye Research Laboratories, Los Angeles, Cal | [{"affiliation":"Dye Research Laboratories, Los Angeles, Calif.","name":"T. R. B |
| `10.5594-J09018` | [{"affiliation":"CBS Television Network, 51 West 52 St., New | [{"affiliation":"CBS Television Network, 51 West 52 St., New York, NY 10019.","n |
| `10.5594-J10202` | [{"name":"E. S. Burnap"}] | [{"name":"R. S. Burnap"}] |
| `10.5594-J10421` | [{"name":"David Howell"},{"name":"D. H."},{"name":"Calvin M. | [{"name":"David Howell"},{"name":"Calvin M. Hotchkiss"}] |
