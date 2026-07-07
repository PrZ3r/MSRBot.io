# Registry vs SMPTE-canonical field diff

> Generated: 2026-07-07T23:57:45.791Z
> Matched docs (DOI): **23517**

## Summary

| field | match | drift | registry-only | canonical-only | both-empty |
|---|---:|---:|---:|---:|---:|
| title | 21114 | **2403** | 0 | 0 | 0 |
| pubYear | 23403 | **114** | 0 | 0 | 0 |
| pubMonth | 21020 | **2497** | 0 | 0 | 0 |
| authors | 10351 | **89** | 71 | 40 | 12966 |
| abstract | 8512 | **126** | 204 | 477 | 14198 |
| keywords | 0 | **0** | 1 | 305 | 23211 |
| journalTitle | 0 | **0** | 0 | 23517 | 0 |

> `registry-only` on abstract/keywords = our enrichment (candidate push-backs to SMPTE).
> `canonical-only` = backfill candidates into the registry.
> `journalTitle` drift is era-sensitive — the registry must reflect the journal name AT TIME of publication, so review before assuming either side wins.

## Drift — title (2403, first 50 shown)

| docId | registry | canonical |
|---|---|---|
| `10.5594-J00031` | "New Motion Picture Apparatus" | "New Motion Picture Apparatus: A Multiduty Motor System<!--<xref ref-type=\"other\" rid=\" |
| `10.5594-J00033` | "Book Review" | "&#x201C;Applied Acoustics&#x201D; (Harry F. Olson and Frank Massa; 1939) [Book Review]" |
| `10.5594-J00034` | "1940 Spring Convention Society of Motion Picture Engineers" | "1940 Spring Convention: Society of Motion Picture Engineers: Chalfonte-Haddon Hall, Atlan |
| `10.5594-J00050` | "Eye, Film and Camera in Color Photography" | "Books Reviewed" |
| `10.5594-J00057` | "New Products" | "New Products: (And Developments)" |
| `10.5594-J00059` | "Report on the 121st SMPTE Technical Conference and Equipment Exhibit" | "Report on the 121st SMPTE Technical Conference and Equipment Exhibit: Century Plaza Hotel |
| `10.5594-J00067` | "50 and 25 Years Ago in the Journal" | "50 Years Ago in the Journal" |
| `10.5594-J00083` | "132nd SMPTE Technical Conference and Equipment Exhibit" | "132nd SMPTE Technical Conference and Equipment Exhibit: October 13&#x2013;17, 1990, New Y |
| `10.5594-J00084` | "Biographical Sketch" | "Biographical Sketch: Frank J. Haney Editorial Vice-President 1989&#x2013;1990" |
| `10.5594-J00088` | "Approved American National Standards" | "Standards and Recommended Practices" |
| `10.5594-J00092` | "Sustaining Members" | "Sustaining Members: Society of Motion Picture and Television Engineers" |
| `10.5594-J00103` | "132nd SMPTE Technical Conference and Equipment Exhibit" | "132nd SMPTE Technical Conference and Equipment Exhibit: Jacob K. Javits Convention Center |
| `10.5594-J00104` | "The 25th Annual SMPTE Television Conference" | "The 25th Annual SMPTE Television Conference: Westin Hotel: Detroit, Michigan February 1&# |
| `10.5594-J00133` | "American National Standard" | "American National Standard: Specifications for Camera Run Length of Film in 8-mm Type S M |
| `10.5594-J00134` | "Sustaining Members" | "Sustaining Members: Society of Motion-Picture and Television Engineers" |
| `10.5594-J00152` | "American National Standards" | "American National Standard: Basic System and Transport Geometry Parameters for 1-in Type  |
| `10.5594-J00153` | "SMPTE Recommended Practices" | "SMPTE Recommended Practice: Video and Audio Reference Tape for 1-in Type B Helical-Scan F |
| `10.5594-J00154` | "SMPTE Recommended Practices" | "SMPTE Recommended Practice: Spectral Response of Photographic Sound Reproducers for 8-mm  |
| `10.5594-J00155` | "SMPTE Engineering Guideline" | "SMPTE Engineering Guideline: Audio Sync Pulse for 8-mm Type S Cameras, Magnetic Audio Rec |
| `10.5594-J00156` | "International Standard" | "Cinematography &#x2013; Spool, Daylight Loading Type, for 35 mm Motion-Picture Cameras (C |
| `10.5594-J00170` | "New" | "News" |
| `10.5594-J00175` | "American National Standard" | "American National Standard: Specifications for 8-mm Type S Motion-Picture Camera Cartridg |
| `10.5594-J00176` | "Proposed American National Standard" | "Proposed American National Standard: Dimensions of Video, Audio and Tracking-Control Reco |
| `10.5594-J00177` | "Proposed SMPTE Recommended Practices" | "Proposed SMPTE Recommended Practices: Reference carrier Frequencies, Pre-emphasis Charact |
| `10.5594-J00187` | "News" | "News: Communications Experts Consider Opportunities for High Definition Television in Can |
| `10.5594-J00191` | "American National Standards" | "American National Standard: Specifications and Conditioning of Raw Tape Stock Used to Rec |
| `10.5594-J00192` | "Society of Motion Picture and Television Engineers, Inc." | "Society of Motion Picture and Television Engineers, Inc.: 862 Scarsdale Avenue, Scarsdale |
| `10.5594-J00193` | "Sustaining Members" | "Sustaining Members: Society of Motion Picture and Television Engineers" |
| `10.5594-J00201` | "Cameras and Systems: A History of Contributions from the Bell & Howell Co. (Part II)" | "SMPTE Historical Paper: Cameras and Systems: A History of Contributions from the Bell &#x |
| `10.5594-J00202` | "The Development of Stereo Magnetic Recording for Film (Part II)" | "SMPTE Historical Paper: The Development of Stereo Magnetic Recording for Film (Part II)" |
| `10.5594-J00203` | "Biographical Sketch: Calvin M. Hotchkiss, SMPTE Chairman, Board of Editors" | "Biographical Sketch" |
| `10.5594-J00204` | "Depths of Field" | "A Technical Note: Depths of Field" |
| `10.5594-J00205` | "Nordiska Film/TV Unionen, NFTU — The Nordic Film and Television Society" | "Tutorial Paper: Nordiska Film/TV Unionen, NFTU &#x2014; The Nordic Film and Television So |
| `10.5594-J00218` | "Approved American National Standards" | "Standards and Recommended Practices" |
| `10.5594-J00219` | "Proposed American National Standards" | "Proposed American National Standards: Recorded Characteristic of Magnetic Audio Records o |
| `10.5594-J00220` | "Sustaining Members" | "Sustaining Members: Society of Motion Picture and Television Engineers" |
| `10.5594-J00232` | "Society of Motion Picture and Television Engineers, Inc." | "Society of Motion Picture and Television Engineers, Inc.: 862 Scarsdale Avenue, Scarsdale |
| `10.5594-J00233` | "124th Annual SMPTE Technical Conference, New York City" | "124th Annual SMPTE Technical Conference and Equipment Exhibit" |
| `10.5594-J00242` | "American National Standards" | "American National Standards: Position, Dimensions and Reproducing Speed of 200-mil Magnet |
| `10.5594-J00243` | "SMPTE Recornmended Practices" | "SMPTE Recommended Practice: Care and Handling of Video Magnetic Recording Tape" |
| `10.5594-J00278` | "1981 Financial Reports: Treasurer's Report - January 1 - December 31, 1981" | "1981 Financial Reports" |
| `10.5594-J00279` | "Biographical Sketch: Howard La Zare. Vice-President for Motion Picture Affairs 1982-83" | "Biographical Sketch: SMPTE Vice-President for Motion Picture Affairs 1982&#x2013;83" |
| `10.5594-J00283` | "News" | "News: Lynette Robinson Named SMPTE Executive Secretary" |
| `10.5594-J00302` | "Proposed American National Standards" | "Proposed American National Standard: Dimensions and Location of Records for &#x00BD;-in T |
| `10.5594-J00303` | "Proposed SMPTE Recommended Practice" | "Proposed SMPTE Recommended Practice: Reference Carrier Frequencies, Pre-Emphasis Characte |
| `10.5594-J00304` | "SMPTE Recommended Practice" | "SMPTE Recommended Practice: Specifications for Sound-Focusing Test Film for 35-mm Sound R |
| `10.5594-J00320` | "New Products" | "New Products and Developments" |
| `10.5594-J00321` | "Approved SMPTE Recommended Practice" | "SMPTE Recommended Practice: Cross-Modulation Tests for Variable-Area Photographic Sound T |
| `10.5594-J00322` | "Approved International Standard" | "Cinematography &#x2014; Monophonic 35 mm Negative Photographic Sound Record on 35 mm Moti |
| `10.5594-J00331` | "124th SMPTE Technical Conference" | "124th SMPTE Technical Conference New York Hilton Hotel, New York November 7&#x2013;12, 19 |

## Drift — pubYear (114, first 50 shown)

| docId | registry | canonical |
|---|---|---|
| `10.5594-J05436` | "1932-11-01" | "1935-1" |
| `10.5594-J15292` | "1992-05-01" | "1995-5" |
| `10.5594-J17253` | "1992-05-01" | "1995-6" |
| `10.5594-J18005` | "1930-02-01" | "1918-4" |
| `10.5594-J18012` | "2001-12-01" | "2011-1" |
| `10.5594-J18027` | "1917-10-01" | "2011-4" |
| `10.5594-J18028` | "1917-10-01" | "2011-4" |
| `10.5594-J18049` | "1916-10-01" | "2011-5" |
| `10.5594-J18212` | "1998-02-01" | "2012-9" |
| `10.5594-J18215` | "1998-02-01" | "2012-9" |
| `10.5594-J18216` | "1998-02-01" | "2012-9" |
| `10.5594-M00395` | "2015-10-19" | "2005-11" |
| `10.5594-j18000` | "2011-01-01" | "1918-4" |
| `10.5594-j18000C1` | "2011-01-01" | "1918-4" |
| `10.5594-j18001` | "2011-01-01" | "1918-4" |
| `10.5594-j18002` | "2011-01-01" | "1918-4" |
| `10.5594-j18003` | "2011-01-01" | "1918-4" |
| `10.5594-j18004` | "2011-01-01" | "1918-4" |
| `10.5594-j18005` | "2011-01-01" | "1918-4" |
| `10.5594-j18006` | "2011-01-01" | "1918-4" |
| `10.5594-j18007` | "2011-01-01" | "1918-4" |
| `10.5594-j18008` | "2011-01-01" | "1918-4" |
| `10.5594-j18013` | "2011-03-01" | "2001-12" |
| `10.5594-j18014` | "2011-03-01" | "2001-12" |
| `10.5594-j18015` | "2011-03-01" | "2001-12" |
| `10.5594-j18016` | "2011-03-01" | "2001-12" |
| `10.5594-j18017` | "2011-03-01" | "2001-12" |
| `10.5594-j18018` | "2011-03-01" | "2001-12" |
| `10.5594-j18019` | "2011-03-01" | "2001-12" |
| `10.5594-j18020` | "2011-03-01" | "2001-12" |
| `10.5594-j18021` | "2011-03-01" | "2001-12" |
| `10.5594-j18022` | "2011-03-01" | "2001-12" |
| `10.5594-j18023` | "2011-03-01" | "2001-12" |
| `10.5594-j18024` | "2011-03-01" | "2001-12" |
| `10.5594-j18035` | "2011-04-01" | "1917-7" |
| `10.5594-j18036` | "2011-04-01" | "1917-7" |
| `10.5594-j18037` | "2011-05-01" | "1917-7" |
| `10.5594-j18038` | "2011-05-01" | "1917-7" |
| `10.5594-j18039` | "2011-05-01" | "1917-7" |
| `10.5594-j18040` | "2011-05-01" | "1917-7" |
| `10.5594-j18041` | "2011-05-01" | "1917-4" |
| `10.5594-j18042` | "2011-05-01" | "1917-4" |
| `10.5594-j18043` | "2011-05-01" | "1917-4" |
| `10.5594-j18044` | "2011-05-01" | "1917-4" |
| `10.5594-j18045` | "2011-05-01" | "1917-4" |
| `10.5594-j18046` | "2011-05-01" | "1917-4" |
| `10.5594-j18051` | "2011-07-01" | "1916-10" |
| `10.5594-j18052` | "2011-07-01" | "1916-10" |
| `10.5594-j18053` | "2011-07-01" | "1916-10" |
| `10.5594-j18054` | "2011-07-01" | "1916-10" |

## Drift — pubMonth (2497, first 50 shown)

| docId | registry | canonical |
|---|---|---|
| `10.5594-J00076C1` | "1990-01-01" | "1990-2" |
| `10.5594-J00076iiA` | "1990-01-01" | "1990-2" |
| `10.5594-J00076iiiiA` | "1990-01-01" | "1990-2" |
| `10.5594-J00076iiiiiiA` | "1990-01-01" | "1990-2" |
| `10.5594-J00093801801A` | "1990-01-01" | "1990-10" |
| `10.5594-J00093C1` | "1990-01-01" | "1990-10" |
| `10.5594-J00093iiA` | "1990-01-01" | "1990-10" |
| `10.5594-J00194C1` | "1982-01-01" | "1982-11" |
| `10.5594-J00194iiA` | "1982-01-01" | "1982-11" |
| `10.5594-J00194iiiiA` | "1982-01-01" | "1982-11" |
| `10.5594-J00221C1` | "1982-01-01" | "1982-10" |
| `10.5594-J00221iiA` | "1982-01-01" | "1982-10" |
| `10.5594-J00221iiiiA` | "1982-01-01" | "1982-10" |
| `10.5594-J00244C1` | "1982-01-01" | "1982-9" |
| `10.5594-J00244iiA` | "1982-01-01" | "1982-9" |
| `10.5594-J00244iiiiA` | "1982-01-01" | "1982-9" |
| `10.5594-J00267C1` | "1982-01-01" | "1982-8" |
| `10.5594-J00267iiA` | "1982-01-01" | "1982-8" |
| `10.5594-J00267iiiiA` | "1982-01-01" | "1982-8" |
| `10.5594-J00369C1` | "1981-01-01" | "1981-12" |
| `10.5594-J00369iiA` | "1981-01-01" | "1981-12" |
| `10.5594-J00369iiiiA` | "1981-01-01" | "1981-12" |
| `10.5594-J00390C1` | "1981-01-01" | "1981-11" |
| `10.5594-J00390iiA` | "1981-01-01" | "1981-11" |
| `10.5594-J00390iiiiA` | "1981-01-01" | "1981-11" |
| `10.5594-J00443C1` | "1980-01-01" | "1980-9" |
| `10.5594-J00443iiA` | "1980-01-01" | "1980-9" |
| `10.5594-J00443iiiiA` | "1980-01-01" | "1980-9" |
| `10.5594-J00522C1` | "1980-01-01" | "1980-2" |
| `10.5594-J00522iiA` | "1980-01-01" | "1980-2" |
| `10.5594-J00522iiiiA` | "1980-01-01" | "1980-2" |
| `10.5594-J00536142142A` | "1980-01-01" | "1980-2" |
| `10.5594-J00585767767A` | "1993-01-01" | "1993-9" |
| `10.5594-J00585768768A` | "1993-01-01" | "1993-9" |
| `10.5594-J00585C1` | "1993-01-01" | "1993-9" |
| `10.5594-J00710C1` | "1983-01-01" | "1983-8" |
| `10.5594-J00710iiA` | "1983-01-01" | "1983-8" |
| `10.5594-J00710iiiiA` | "1983-01-01" | "1983-8" |
| `10.5594-J00749C1` | "1928-01-01" | "1928-9" |
| `10.5594-J00749IIA` | "1928-01-01" | "1928-9" |
| `10.5594-J00749IIIIA` | "1928-01-01" | "1928-9" |
| `10.5594-J00749IIIIIIA` | "1928-01-01" | "1928-9" |
| `10.5594-J00839C1` | "1970-01-01" | "1970-12" |
| `10.5594-J00839iiA` | "1970-01-01" | "1970-12" |
| `10.5594-J00839iiiiA` | "1970-01-01" | "1970-12" |
| `10.5594-J00866C1` | "1926-01-01" | "1926-10" |
| `10.5594-J00866iiA` | "1926-01-01" | "1926-10" |
| `10.5594-J00866iiiiA` | "1926-01-01" | "1926-10" |
| `10.5594-J00866iiiiiiA` | "1926-01-01" | "1926-10" |
| `10.5594-J00884C1` | "1970-01-01" | "1970-8" |

## Drift — authors (89, first 50 shown)

| docId | registry | canonical |
|---|---|---|
| `10.5594-J00465` | ["Mr. William S. Halstead","Richard W. Burden"] | ["William S. Halstead","Richard W. Burden"] |
| `10.5594-J00536142142A` | ["G.R."] | ["Gury Rosenberger"] |
| `10.5594-J00666` | ["By Richard G. Streeter"] | ["Richard G. Streeter"] |
| `10.5594-J00867` | ["W. A. Cook","L. A. Jones"] | ["Willard B. Cook","L. A. Jones"] |
| `10.5594-J01003` | ["Harry R. Lubcke","O.W.R.","V.A.","V.A.","V.A."] | ["Harry R. Lubcke"] |
| `10.5594-J01128` | ["Harry R. Glason"] | ["Harry R. Clason"] |
| `10.5594-J03550` | ["J. van den Berg","N. V. van den Rao"] | ["J. van den Berg","N. V. Rao"] |
| `10.5594-J05045` | ["A. C. Dowries"] | ["A. C. Downes"] |
| `10.5594-J05083` | ["James Y. Dunbar","William J. Scully"] | ["James Y. Dunbar"] |
| `10.5594-J05722` | ["George L. George","A. E. A."] | ["George L. George"] |
| `10.5594-J05731` | ["Manfred G. Mighelson"] | ["Manfred G. Michelson"] |
| `10.5594-J05746` | ["C. Gaswick","R. J. Rechter"] | ["C. Caswick","R. J. Rechter"] |
| `10.5594-J05852` | ["J. W. Dally","Miss L. V. Brillhart"] | ["J. W. Dally","L. V. Brillhart"] |
| `10.5594-J05889` | ["F. W. de Vrijer","A. L. Tan","A. G. van Doorns"] | ["F. W. de Vrijer","A. L. Tan","A. G. van Doorn"] |
| `10.5594-J06198` | ["Erik Igelstam"] | ["Erik Ingelstam"] |
| `10.5594-J06610` | ["U. L. Mistry"] | ["D. L. Mistry"] |
| `10.5594-J07182` | ["Williams, G.","Strong, M."] | ["Gordon Williams","Michael Strong"] |
| `10.5594-J07544` | ["Yoshi Ohno"] | ["John P. Pytlak","Alfred W. Fleischer"] |
| `10.5594-J07583` | ["Uhlig, Ronald E. "] | ["Ronald E. Uhlig"] |
| `10.5594-J08310` | ["Miller, A.J","Robertson, A.C"] | ["A. J. Miller","A. C. Robertson"] |
| `10.5594-J08599` | ["Louis Lumiègre"] | ["Louis Lumiere"] |
| `10.5594-J08654` | ["T. R. Barraber"] | ["T. R. Barrabee"] |
| `10.5594-J09018` | ["G. I. Benkowsky","D. A. Cohn","D. Horowitz","V. E. Rogco"] | ["G. I. Benkowsky","D. A. Cohn","D. Horowitz","V. E. Rocco"] |
| `10.5594-J10202` | ["E. S. Burnap"] | ["R. S. Burnap"] |
| `10.5594-J10421` | ["David Howell","D. H.","Calvin M. Hotchkiss"] | ["David Howell","Calvin M. Hotchkiss"] |
| `10.5594-J10863` | ["Pierre Mertz"] | ["Pierre Mertz","Berlyn Brixner","Ottmar H. Dengel","Marvin Camras","Alex E. Alden"] |
| `10.5594-J11426` | ["J. Chandaria","G. Thomas","B. Bartczak","K. Koeser","R. Koch","M. Becker","G. Bleser","D | ["J. Chandaria","G. Thomas","B. Bartczak","K. Koeser","R. Koch","M. Becker","G. Bleser","D |
| `10.5594-J11462` | ["Michsel Dolan"] | ["Michael Dolan"] |
| `10.5594-J11525` | ["Frederick C. Motts"] | ["Frederick C. Motts","Warren Buffet"] |
| `10.5594-J11679` | ["H. J. Schlafly"] | ["H. J. Schlafly","Alfred N. Goldsmith","Charles F. Hoban"] |
| `10.5594-J11743` | ["Josepii S. Friedman"] | ["Joseph S. Friedman","Lloyd E. Varden","Glenn E. Matthews"] |
| `10.5594-J11956` | ["J. R. Aburger"] | ["J. R. Alburger"] |
| `10.5594-J11990` | ["Frayne, J.G.","Scoville, R.R."] | ["J. G. Frayne","R. R. Scoville"] |
| `10.5594-J12007` | ["H. Nbumann"] | ["H. Neumann"] |
| `10.5594-J12629` | ["K. E. Carlson"] | ["F. E. Carlson"] |
| `10.5594-J12632` | ["G. W. Read","Scoville, R.R."] | ["G. W. Read","R. R. Scoville"] |
| `10.5594-J13132` | ["Arthur C. Hardy"] | ["Donald MacKenzie"] |
| `10.5594-J13134` | ["Donald MacKenzie"] | ["Arthur C. Hardy"] |
| `10.5594-J13486` | ["Sidney P. Solow","Eric M. Berndt"] | ["Herbert E. Farmer","Roderick T. Ryan"] |
| `10.5594-J13515` | ["Reid H. Ray","A. E. A.","A. E. A."] | ["Reid H. Ray"] |
| `10.5594-J14583` | ["J. F. Dunn"] | ["Don Norwood"] |
| `10.5594-J14711` | ["Baker, J. O.","Robinson, D. H."] | ["J. O. Baker","D. H. Robinson"] |
| `10.5594-J14911` | ["Azcar Karl Paulsen","Larry Thorpe","Bruce Devlin"] | ["Karl Paulsen","Larry Thorpe","Bruce Devlin"] |
| `10.5594-J14913` | ["Curtis Clark","Michael Goi","David Reisner","Dave Stump","Richard Edlund","Al Barton","L | ["Curtis Clark","Michael Goi","David Reisner","Dave Stump","Richard Edlund","Al Barton","L |
| `10.5594-J15060` | ["Curtis Clark","Daryn Okada","David Reisner","Dave Stump","Richard Edlund","Lou Levinson" | ["Curtis Clark","Daryn Okada","David Reisner","Dave Stump","Richard Edlund","Lou Levinson" |
| `10.5594-J15086` | ["A. Nowak","S. Föβel"] | ["A. Nowak","S. Fossel"] |
| `10.5594-J15588` | ["B. Seeger","W. Jaedicke"] | ["B. Seeger","W. Jaedicke","Norman Macbeth"] |
| `10.5594-J15891` | ["Ken Davies"] | ["Carol King"] |
| `10.5594-J16076` | ["Curtis Clark","David Reisner","Dave Stump","Lou Levin-Son","Joshua Pines","Gary Demos"," | ["Curtis Clark","David Reisner","Dave Stump","Lou Levinson","Joshua Pines","Gary Demos","A |
| `10.5594-J16744` | ["Robert C. Brown","Robert A. Morris","Reid J. O'sConnell"] | ["Robert C. Brown","Robert A. Morris","Reid J. O'Connell"] |

## Drift — abstract (126, first 50 shown)

| docId | registry | canonical |
|---|---|---|
| `10.5594-J00502` | "A new sound negative film for variable-area photographic soundtracks has been de" | "A new sound negative film for variable-area photographic soundtracks has been de" |
| `10.5594-J00611` | "This article describes the Vision IIITM SCATM imaging methods used in recording " | "This article describes the Vision III&#x2122; SCA&#x2122; imaging methods used i" |
| `10.5594-J00882` | "For the purpose of the following notes the definition of stereoscopy is the obta" | "For the purpose of the following notes the definition of stereo-scopy is the obt" |
| `10.5594-J01182` | "This is a system for monitoring the light output of an arc projector during proj" | "This is a system for monitoring the light output of an are projector during proj" |
| `10.5594-J01287` | "Results of investigations on sources of direct current for the non-rotating, hig" | "Results of investigations on sources of direct current for the non-rotating, hig" |
| `10.5594-J02039` | "Summary—To increase the light output per watt, to improve the actinicity of the " | "To increase the light output per watt, to improve the actinicity of the light, t" |
| `10.5594-J03040` | "This article describes a new process referred to as HD-NTSCTM. This signal has a" | "This article describes a new process referred to as HD-NTSC<sup>TM</sup>. This s" |
| `10.5594-J03349` | "This article describes a device for automatic silver recovery designed by the au" | "This article describes a device for automatic silver recovery designed by the au" |
| `10.5594-J04027` | "An algorithm and a real-time hardware implementation are described for coding co" | "An algorithm and a real-time hardware implementation are described for coding co" |
| `10.5594-J04370` | "A high-definition camera has been developed that produces color images with 1920" | "A high-definition camera has been developed that produces color images with 1920" |
| `10.5594-J04509` | "The paper describes the configuration and performance of Image Light Amplifier (" | "The paper describes the configuration and performance of Image Light Amplifier (" |
| `10.5594-J04931` | "A heavy-duty 16mm projector was described in 1950 by the author.1 This projector" | "A heavy-duty 16mm projector was described in 1950 by the author.<sup>1</sup> Thi" |
| `10.5594-J05012` | "The Synchro-screen* is described as consisting of a motion picture screen with c" | "The Synchro-screen<sup>&#x002A;</sup> is described as consisting of a motion pic" |
| `10.5594-J05058` | "This Frum was sponsored by the SMPE Atlantic Coast Section and the Acoustical So" | "This Forum was sponsored by the SMPE Atlantic Coast Section and the Acoustical S" |
| `10.5594-J05447` | "Super pan negative film represents a refinement in film manufacture rather than " | "Superpan negative film represents a refinement in film manufacture rather than a" |
| `10.5594-J05502` | "In 1926, Capstaff and Seymour1 published a paper giving directions for making du" | "In 1926, Capstaff and Seymour<sup>1</sup> published a paper giving directions fo" |
| `10.5594-J05509` | "The variation of photographic sensitivity (as measured by the index 10/Em) with " | "The variation of photographic sensitivity (as measured by the index 10/E<inf>m</" |
| `10.5594-J05803` | "These notices aro published as a servlce to expodite disposal and ocquisition of" | "These notices are published as a service to expedite disposal and acquisition of" |
| `10.5594-J05824` | "Inherent in every TV imaging tube are the horizontal and vertical sweep nonlin-e" | "Inherent in every TV imaging tube are the horizontal and vertical sweep nonlinea" |
| `10.5594-J05834` | "A short history of underwater photography is given. The necessity for the inte-g" | "A short history of underwater photography is given. The necessity for the integr" |
| `10.5594-J06004` | "The Marconi Mark IV 4½ image-orthicon camera was introduced to the SMPTE in 1959" | "The Marconi Mark IV 4&#x00BD;-in. image-orthicon camera was introduced to the SM" |
| `10.5594-J06040` | "A giant-pulsed laser is used to actively illuminate a distant target with a ligh" | "A giant-pulsed laser is used to actively illuminate a distant target with a ligh" |
| `10.5594-J06067` | "An abridgment of the author's revision of a paper presented on May I, 7962, at t" | "An abridgment of the author&#x0027;s revision of a paper presented on May 1, 196" |
| `10.5594-J06788` | "Foreword This Television Systems Bulletin was developed by the EIA Engineering D" | "This Television Systems Bulletin was developed by the EIA Engineering Department" |
| `10.5594-J07029` | "Techniques using the three parameters of the sin2 window signal (pulse tops and " | "Techniques using the three parameters of the sin<sup>2</sup> window signal (puls" |
| `10.5594-J07259` | "The discharges were performed in a coaxial flash x-ray tube (voltage = 15 kv, pr" | "The discharges were performed in a coaxial flash x-ray tube (voltage &#x003D; 15" |
| `10.5594-J07455` | "This paper provides further details of the Selenophon system described previousl" | "This paper provides further details of the Selenophon system described previousl" |
| `10.5594-J07707` | "A high-speed contact duplicator, capable of making video copies from a standard " | "A high-speed contact duplicator, capable of making video copies from a standard " |
| `10.5594-J07814` | "The recently developed temperalure-and-field emitter is useful in applications r" | "The recently developed temperature-and-field emitter is useful in applications r" |
| `10.5594-J07916` | "Since the introduction of high-speed color negative films, the cinematogra-pher " | "Since the introduction of high-speed color negative films, the cinematographer i" |
| `10.5594-J08003` | "his paper describes a two-position console developed to handle mltitrack rerecor" | "This paper describes a two-position console developed to handle mltitrack rereco" |
| `10.5594-J08081` | "Summary.—According to this writer the new factor in the talkies is sound for its" | "According to this writer the new factor in the talkies is sound for its own sake" |
| `10.5594-J08082` | "Summary. — Impurities in the water supply are classified as follows: Dissolved s" | "Impurities in the water supply are classified as follows: Dissolved salts, suspe" |
| `10.5594-J08125` | "Just-noticeable differences (JND) in terms of rms granularity (σD) have been det" | "Just-noticeable differences (JND) in terms of rms granularity (&#x03C3;<inf>D</i" |
| `10.5594-J08277` | "For reasons set forth it was decided to design a new format along with a new tot" | "For reasons set forth it was decided to design a new format along with a new tot" |
| `10.5594-J08595` | "A recording physical densitometer designed to read strips from the type IIb sens" | "A recording physical densitometer designed to read strips from the type IIb sens" |
| `10.5594-J08605` | "The invention of flexible film and Mazda light made possible slide-films having " | "The invention of flexible film and Mazda light made possible slide-films having " |
| `10.5594-J08857` | "milling out a 16mm camera aperture plate so that most of the film area ordinaril" | "By milling out a 16mm camera aperture plate so that most of the film area ordina" |
| `10.5594-J09230` | "Because of the need for a low-production-cost, mass communications medium for te" | "Because of the need for a low-production-cost, mass communications medium for th" |
| `10.5594-J09264` | "Photographic instruments have aided immeasurably in the acquisition of data duri" | "Photographic instruments have aided immeasurably in the acquisition of data duri" |
| `10.5594-J09870` | "The motion picture and the automobile were bom at the turn of the century and gr" | "The motion picture and the automobile were born at the turn of the century and g" |
| `10.5594-J10025` | "The Television Committee of the Society during the past year has carried out a c" | "The Television Committee of the Society during the past year has carried out a c" |
| `10.5594-J10097` | "A definition of a graininess coefficient G is given by the distribution function" | "A definition of a graininess coefficient G is given by the distribution function" |
| `10.5594-J10412` | "An ion-exchange process has achieved almost complete removal of hexacyanoferrate" | "An ion-exchange process has achieved almost complete removal of hexacyanoferrate" |
| `10.5594-J10760` | "Although a video signal from a TV camera always contains noise, the signal-to-no" | "Noise&#x002A; is a source of impairment in any form of information transmission " |
| `10.5594-J10781` | "Editorial Note: Ivan Putora wrote this paper as a thesis at one of Czechoslovaki" | "Ivan Putora wrote this paper as a thesis at one of Czechoslovakia&#x0027;s offic" |
| `10.5594-J11124` | "Before his death in 1955, Samuel B, Grimson* developed an ingenious film pulldow" | "Before his death in 1955, Samuel B, Grimson<sup>&#x002A;</sup> developed an inge" |
| `10.5594-J11152` | "This paper discusses theoretical circuit requirements for anamorphic television," | "This paper discusses theoretical circuit requirements for anamorphic television," |
| `10.5594-J11273` | "A technique, recently described1 for recovery of Eastman Color developers, has b" | "A technique, recently described<sup>1</sup> for recovery of Eastman Color develo" |
| `10.5594-J11603` | "The scope of compression techniques provided in the MPEG-2 toolkit is brood enou" | "The scope of compression techniques provided in the MPEG-2 toolkit is broad enou" |

