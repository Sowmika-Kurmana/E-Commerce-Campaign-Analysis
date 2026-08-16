# E-Commerce-Campaign-Analysis

## 1. Business Problem

An e-commerce company ran two promotional campaigns, a **Control Campaign** and a **Test Campaign**, to improve customer purchasing behavior. The company wants to determine whether the Test Campaign generated better sales conversion than the Control Campaign.

Simply observing a difference in purchases is not sufficient because differences may occur due to natural variation. Therefore, statistical hypothesis testing will be used to determine whether the observed difference in conversion performance is statistically significant.

### Business Question

**Did the Test Campaign significantly improve customer conversion compared with the Control Campaign?**

## 2. Project Objective

The main objectives of this project are:

* Compare the performance of the Control and Test Campaigns.
* Analyze customer conversion and purchasing behavior.
* Calculate and compare the conversion rates of both campaigns.
* Perform statistical hypothesis testing to determine whether the difference is significant.
* Identify which campaign performed better.
* Provide a data-driven recommendation on whether the Test Campaign should be adopted.

## 3. Dataset Description

The dataset contains user-level data from an **A/B testing experiment** conducted to evaluate the effectiveness of a new landing page.

The experiment divides users into two groups:

* **Control Group** – Users who were shown the existing (`old_page`) landing page.
* **Treatment Group** – Users who were shown the new (`new_page`) landing page.

The dataset contains **294,478 user records** and **5 variables**.

### Dataset Variables

| Variable       | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `user_id`      | Unique identifier for each user                                 |
| `timestamp`    | Date and time of the user's interaction                         |
| `group`        | Experiment group: `control` or `treatment`                      |
| `landing_page` | Landing page shown: `old_page` or `new_page`                    |
| `converted`    | Conversion outcome: `1` for converted and `0` for not converted |

The primary outcome variable is **`converted`**, which will be used to calculate conversion rates and determine whether the new landing page significantly improves user conversion compared with the existing landing page.
## 4. Tools & Technologies

* **Python** – Data analysis and statistical testing
* **Pandas** – Data cleaning and manipulation
* **NumPy** – Numerical calculations
* **Matplotlib** – Data visualization
* **SciPy** – Statistical hypothesis testing
* **Jupyter Notebook** – Development and analysis environment
* **GitHub** – Project documentation and portfolio


## 5. Project Workflow

The project follows these steps:

1. Load and inspect the dataset
2. Identify duplicate and invalid records
3. Clean and prepare the data
4. Perform exploratory data analysis
5. Calculate conversion rates for Control and Treatment groups
6. Compare conversion performance
7. Perform statistical hypothesis testing
8. Interpret the statistical results
9. Develop business recommendations


## 6. Data Cleaning

The dataset was cleaned before performing the A/B test.

The following steps were performed:

* Inspected the dataset structure and data types.
* Checked for duplicate records.
* Identified duplicate users.
* Identified invalid combinations between experiment groups and landing pages.
* Removed invalid records.
* Removed duplicate users while retaining the first occurrence.
* Checked for missing values.
* Verified the values of the experiment variables.
* Converted the `timestamp` column to datetime format.

The original dataset contained **294,478 records**. After cleaning and removing duplicate users, the final dataset contained **290,584 records**.


## 7. Exploratory Data Analysis

Exploratory Data Analysis was performed to understand user distribution and conversion behavior across the Control and Treatment groups.

The analysis included:

* Distribution of users across experiment groups
* Conversion and non-conversion counts
* Conversion rate calculation
* Comparison of Control and Treatment conversion rates
* Analysis of the difference in conversion performance

The Control group achieved a conversion rate of approximately **12.04%**, while the Treatment group achieved approximately **11.88%**.


## 8. A/B Testing Methodology

A **two-proportion z-test** was used to determine whether the difference in conversion rates between the Control and Treatment groups was statistically significant.

### Hypotheses

**Null Hypothesis (H₀):**
There is no significant difference in conversion rates between the Control and Treatment groups.

**Alternative Hypothesis (H₁):**
There is a significant difference in conversion rates between the Control and Treatment groups.

### Significance Level

The significance level was set to:

**α = 0.05**

The test calculated the conversion rates, conversion difference, relative lift, z-statistic, and p-value.


## 9. Key Results

| Metric                    |  Result |
| ------------------------- | ------: |
| Control Conversion Rate   |  12.04% |
| Treatment Conversion Rate |  11.88% |
| Relative Conversion Lift  |  -1.31% |
| z-statistic               |  -1.312 |
| p-value                   | 0.18965 |
| Significance Level        |    0.05 |

The Treatment group had a slightly lower observed conversion rate than the Control group.

However, the **p-value of 0.18965 is greater than 0.05**. Therefore, the null hypothesis was not rejected.

There is **insufficient statistical evidence to conclude that the Treatment campaign produced a significantly different conversion rate from the Control campaign**.


## 10. Business Recommendations

Based on the A/B testing results:

* Retain the existing landing page as the current version.
* Do not replace the existing landing page based only on the observed conversion difference.
* Continue experimenting with improved landing page designs and content.
* Use further A/B tests to identify changes that can produce a statistically significant improvement in conversion.

Although the Treatment group showed a **1.31% relative decrease** in conversion, this difference was not statistically significant.


## 11. Conclusion

This project evaluated the effectiveness of a new landing page using an A/B testing approach.

The Control group achieved a conversion rate of **12.04%**, while the Treatment group achieved **11.88%**.

The two-proportion z-test produced a **p-value of 0.18965**, which is greater than the 0.05 significance level.

Therefore, there is insufficient statistical evidence to conclude that the Treatment campaign significantly improved or reduced conversion compared with the Control campaign.

Based on the experiment, the existing landing page should be retained while further experimentation is conducted.


## 12. Project Structure

```text
E-Commerce-Campaign-Analysis/
│
├── ab_data.csv
├── E-Commerce-Campaign-Analysis.ipynb
├── README.md
└── requirements.txt
```


## 13. How to Run

### 1. Clone the repository

```bash
git clone <https://github.com/Sowmika-Kurmana/E-Commerce-Campaign-Analysis>
```

### 2. Navigate to the project folder

```bash
cd E-Commerce-Campaign-Analysis
```

### 3. Install the required libraries

```bash
pip install pandas numpy matplotlib scipy jupyter
```

### 4. Launch Jupyter Notebook

```bash
jupyter notebook
```

### 5. Open the notebook

Open:

`E-Commerce-Campaign-Analysis.ipynb`

Run the notebook cells sequentially to reproduce the analysis.


## 14. Author

**Sowmika Kurmana**

B.Tech – Computer Science and Data Science

Anil Neerukonda Institute of Technology & Sciences (ANITS)
